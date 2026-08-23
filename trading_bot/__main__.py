"""CLI : ``python -m trading_bot --help``."""

from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import sys

from .config import BacktestConfig, Config, DataConfig, LabelConfig, ModelConfig, SplitConfig
from .pipeline import run


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m trading_bot",
        description="Estimation calibrée de la probabilité d'un mouvement de marché.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    g = p.add_argument_group("données")
    g.add_argument("--symbol", default="EURUSD=X",
                   help="symbole du provider (Yahoo : EURUSD=X ; Alpha Vantage : EUR/USD)")
    g.add_argument("--interval", default="1day")
    g.add_argument("--outputsize", type=int, default=2000)
    g.add_argument("--provider",
                   choices=["yahoo", "alphavantage", "twelvedata", "csv", "synthetic"],
                   default="yahoo")
    g.add_argument("--csv-path")
    g.add_argument("--cache-ttl-hours", type=float, default=12.0)

    g = p.add_argument_group("événement")
    g.add_argument("--event", choices=["direction", "amplitude", "triple_barrier"],
                   default="direction", help="ce dont on estime la probabilité")
    g.add_argument("--horizon", type=int, default=1)
    g.add_argument("--barrier-atr", type=float, default=1.0)
    g.add_argument("--barrier-pct", type=float, default=0.005,
                   help="seuil absolu de l'événement amplitude (0.005 = 0.5 %%)")
    g.add_argument("--threshold-mode", choices=["pct", "atr"], default="pct")

    g = p.add_argument_group("validation")
    g.add_argument("--n-splits", type=int, default=5)
    g.add_argument("--embargo", type=int, default=5)
    g.add_argument("--min-train-size", type=int, default=250)
    g.add_argument("--max-train-size", type=int, default=None,
                   help="fenêtre d'entraînement glissante (défaut : expansive)")
    g.add_argument("--baseline-window", type=int, default=250)
    g.add_argument("--model", choices=["logistic", "gbm"], default="logistic")
    g.add_argument("--evidence-weight", type=float, default=0.5,
                   help="<1 amortit l'écart à la baseline")
    g.add_argument("--calibration", choices=["sigmoid", "isotonic", "none"], default="sigmoid")
    g.add_argument("--feature-transform", choices=["rank", "raw"], default="rank")
    g.add_argument("--prior", choices=["adaptive", "train"], default="adaptive",
                   help="ancrage du niveau de probabilité")
    g.add_argument("--fast", action="store_true", help="désactive Hurst et l'entropie")

    g = p.add_argument_group("backtest")
    g.add_argument("--spread-bps", type=float, default=1.0,
                   help="coût proportionnel PAR CÔTÉ (aller-retour = 2x) ; "
                        "y sommer demi-spread + commission + slippage")
    g.add_argument("--edge-threshold", type=float, default=0.02)

    g = p.add_argument_group("multi-actifs")
    g.add_argument("--panel", action="store_true",
                   help="entraîne UN modèle mutualisé sur plusieurs actifs (voir --universe)")
    g.add_argument("--no-funding", action="store_true",
                   help="désactive le financement overnight (taux BIS)")
    g.add_argument("--universe", nargs="+", default=None,
                   help="symboles Yahoo ; défaut = panier FX/actions/matières/crypto")

    p.add_argument("--json", metavar="PATH", help="écrit les prédictions en CSV et un résumé JSON")
    p.add_argument("-v", "--verbose", action="store_true")
    return p


def _run_panel(cfg: Config, args) -> int:
    """Mode mutualisé : un seul modèle pour tous les actifs du panier."""
    from . import evaluate, panel
    from .data import DEFAULT_UNIVERSE

    symbols = args.universe or list(DEFAULT_UNIVERSE)
    try:
        pan = panel.build_panel(symbols, cfg, include_slow=not args.fast)
        predictions = panel.walk_forward(pan, cfg)
    except Exception as exc:
        print(f"Échec : {exc}", file=sys.stderr)
        return 1

    report = evaluate.evaluate(predictions)

    rate_table = None
    if not args.no_funding:
        from . import rates as rates_module
        try:
            rate_table = rates_module.load_rates(
                list(rates_module.AREA_BY_CURRENCY), cfg.data.cache_path
            )
        except Exception as exc:
            print(f"Taux indisponibles, financement non modélisé : {exc}", file=sys.stderr)

    result = panel.portfolio_backtest(pan, predictions, cfg, rates=rate_table)

    print("=" * 72)
    print(f"PANEL MUTUALISÉ : {pan.frame['symbol'].nunique()} actifs, "
          f"{len(pan.frame):,} lignes")
    print(f"ÉVÉNEMENT       : {labels_describe(cfg)}")
    print("=" * 72)
    print("\n--- QUALITÉ DE LA PROBABILITÉ " + "-" * 42)
    print(report.to_text())
    print("\n--- PORTEFEUILLE (parité de risque) " + "-" * 36)
    print(result.to_text())

    # Contrôle de microstructure : systématique, jamais optionnel. C'est le
    # test qui distingue un edge tradable d'un artefact du prix de clôture.
    print("\n--- ROBUSTESSE AU DÉCALAGE D'EXÉCUTION " + "-" * 33)
    robustness = panel.lag_robustness(pan, predictions, cfg, rates=rate_table)
    print(robustness.to_string())
    if robustness.attrs["tradable"]:
        print("\n>>> Le résultat survit à une barre supplémentaire : plausiblement "
              "tradable.")
    else:
        print("\n>>> ALERTE : le résultat s'effondre dès qu'on saute une barre.")
        print("    Tout le rendement est concentré sur le premier print après le "
              "signal —")
        print("    c'est la signature du bruit de clôture (bid-ask bounce, cotation")
        print("    périmée), pas d'un effet exploitable. NON TRADABLE.")
    if not report.has_skill:
        print("\nATTENTION : sans skill, les chiffres de portefeuille sont du bruit.")
    return 0 if report.has_skill else 2


def labels_describe(cfg: Config) -> str:
    from .labels import describe
    return describe(cfg.label)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    cfg = Config(
        data=DataConfig(symbol=args.symbol, interval=args.interval, outputsize=args.outputsize,
                        provider=args.provider, csv_path=args.csv_path,
                        cache_ttl_hours=args.cache_ttl_hours),
        label=LabelConfig(kind=args.event, horizon=args.horizon, barrier_atr=args.barrier_atr,
                          barrier_pct=args.barrier_pct, threshold_mode=args.threshold_mode),
        split=SplitConfig(n_splits=args.n_splits, embargo=args.embargo,
                          min_train_size=args.min_train_size,
                          max_train_size=args.max_train_size,
                          baseline_window=args.baseline_window),
        model=ModelConfig(name=args.model, calibration=args.calibration,
                          feature_transform=args.feature_transform, prior=args.prior,
                          evidence_weight=args.evidence_weight),
        backtest=BacktestConfig(spread_bps=args.spread_bps, edge_threshold=args.edge_threshold),
    )

    if args.panel:
        return _run_panel(cfg, args)

    try:
        result = run(cfg, include_slow=not args.fast)
    except Exception as exc:
        print(f"Échec : {exc}", file=sys.stderr)
        return 1

    print(result.to_text())

    if args.json:
        result.predictions.to_csv(f"{args.json}.predictions.csv")
        summary = {
            "config": cfg.to_dict(),
            "event": result.event,
            **{k: v for k, v in dataclasses.asdict(result.report).items()
               if k not in ("reliability", "per_fold")},
            "reliability": result.report.reliability.to_dict(orient="records"),
            "per_fold": result.report.per_fold.to_dict(orient="records"),
        }
        if result.backtest is not None:
            summary["backtest"] = {
                k: v for k, v in dataclasses.asdict(result.backtest).items() if k != "equity"
            }
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(summary, handle, indent=2, ensure_ascii=False, default=str)
        print(f"\nÉcrit : {args.json} et {args.json}.predictions.csv")

    # Code de sortie exploitable en CI : 0 seulement si le modèle bat la baseline.
    return 0 if result.report.has_skill else 2


if __name__ == "__main__":
    raise SystemExit(main())
