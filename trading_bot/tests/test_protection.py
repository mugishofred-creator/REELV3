"""Protection du capital : ce qui est possible, ce qui ne l'est pas, à quel prix."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import protection as R


@pytest.fixture
def risky() -> pd.Series:
    """Actif à dérive positive et volatilité réaliste.

    Dérive volontairement franche : avec μ = 0.0004 et σ = 0.011 sur 12 ans,
    l'erreur-type de la moyenne vaut 0.0002 — la dérive réalisée peut sortir
    négative par simple malchance, ce qui inverse toutes les comparaisons du
    fichier. Un test ne doit pas dépendre du tirage.
    """
    rng = np.random.default_rng(7)
    n = 252 * 12
    index = pd.bdate_range("2012-01-01", periods=n)
    series = pd.Series(rng.normal(0.0008, 0.011, n), index=index)
    assert series.mean() > 0, "le montage doit avoir une dérive réalisée positive"
    return series


# --------------------------------------------------------------------------- #
# Le frein de volatilité : le seul gain réellement gratuit
# --------------------------------------------------------------------------- #
def test_drag_matches_the_theoretical_formula(risky):
    """``g ≈ μ − σ²/2``. Vérifié sur données réelles à 0,003 point près."""
    measured = R.volatility_drag(risky)
    assert measured["frein observé"] == pytest.approx(measured["σ²/2 théorique"], rel=0.05)


def test_reducing_exposure_lowers_geometric_growth(risky):
    """Diviser l'exposition divise μ **et** σ : la croissance composée baisse.

    C'est pourquoi « moins risquer » n'est pas « gagner plus » — contrairement
    à une intuition répandue.
    """
    full = R.volatility_drag(risky)
    half = R.volatility_drag(risky * 0.5)
    assert half["μ arithmétique"] == pytest.approx(full["μ arithmétique"] / 2, rel=0.01)
    assert half["g géométrique"] < full["g géométrique"]


def test_diversification_raises_growth_without_touching_the_mean():
    """Le seul mécanisme qui réduit σ **sans** réduire μ.

    Cinq actifs de même espérance et indépendants : la moyenne du panier
    conserve μ et divise σ par √5, donc le frein par 5, donc g monte.
    """
    rng = np.random.default_rng(8)
    n = 252 * 10
    index = pd.bdate_range("2014-01-01", periods=n)
    assets = pd.DataFrame(
        {f"A{i}": rng.normal(0.0008, 0.014, n) for i in range(5)}, index=index
    )

    components = [R.volatility_drag(assets[c]) for c in assets.columns]
    basket = R.volatility_drag(assets.mean(axis=1))

    # Énoncé exact du repas gratuit : le panier conserve la moyenne des μ, mais
    # sa croissance composée dépasse la moyenne des croissances composées.
    mean_mu = np.mean([c["μ arithmétique"] for c in components])
    mean_g = np.mean([c["g géométrique"] for c in components])
    mean_vol = np.mean([c["volatilité"] for c in components])

    assert basket["μ arithmétique"] == pytest.approx(mean_mu, rel=0.02)
    assert basket["volatilité"] < 0.6 * mean_vol          # ~1/racine(5)
    assert basket["frein observé"] < 0.35 * np.mean([c["frein observé"] for c in components])
    assert basket["g géométrique"] > mean_g               # le repas gratuit


# --------------------------------------------------------------------------- #
# Protection du capital : faisable, et son prix est déterminé
# --------------------------------------------------------------------------- #
def test_participation_is_fixed_by_rates_and_horizon(risky):
    """La part investie n'est pas un choix : elle découle du taux et de
    l'horizon. Plus les taux sont bas, plus la garantie coûte cher."""
    short = R.capital_floor(risky, horizon_years=3, risk_free_rate=0.036)
    long = R.capital_floor(risky, horizon_years=15, risk_free_rate=0.036)
    assert "10%" in short.name          # 1 − 1/1.036³
    assert "41%" in long.name
    assert long.volatility > short.volatility


def test_low_rates_make_protection_more_expensive(risky):
    rich = R.capital_floor(risky, 10, risk_free_rate=0.05)
    poor = R.capital_floor(risky, 10, risk_free_rate=0.005)
    assert rich.volatility > poor.volatility      # plus de participation
    assert rich.annualised > poor.annualised


def test_capital_floor_eliminates_losing_years(risky):
    """La contrepartie mesurée : la perte disparaît, le rendement aussi."""
    unprotected = R._measure("brut", risky)
    protected = R.capital_floor(risky, 3, 0.036)

    assert protected.prob_loss == 0.0
    assert protected.max_drawdown > -0.05
    assert protected.annualised < unprotected.annualised     # le prix payé


def test_protection_does_not_raise_geometric_growth(risky):
    """Le cœur de la question posée : borner la perte **n'augmente pas**
    l'espérance, ni arithmétique ni géométrique. Elle achète de la sécurité."""
    unprotected = R._measure("brut", risky)
    protected = R.capital_floor(risky, 5, 0.036)
    assert protected.geometric < unprotected.geometric
    assert protected.arithmetic < unprotected.arithmetic


# --------------------------------------------------------------------------- #
# CPPI
# --------------------------------------------------------------------------- #
def test_cppi_ratchet_floor_only_rises(risky):
    """Le plancher cliquet verrouille les gains : le drawdown reste borné même
    après une forte hausse."""
    result = R.cppi(risky, multiplier=3, floor=0.90, risk_free_rate=0.036)
    assert result.max_drawdown > -0.15


def test_cppi_multiplier_trades_protection_for_return(risky):
    timid = R.cppi(risky, multiplier=2, floor=0.90)
    bold = R.cppi(risky, multiplier=5, floor=0.80)
    assert bold.annualised > timid.annualised
    assert bold.max_drawdown < timid.max_drawdown      # plus profond


def test_cppi_gap_risk_is_real():
    """En temps discret la perte **n'est pas** bornée : un saut supérieur à
    ``1/m`` en une séance traverse le plancher. Avec m = 5, une chute de 20 %
    suffit — et elle s'est produite plusieurs fois dans l'histoire.
    """
    index = pd.bdate_range("2020-01-01", periods=300)
    returns = pd.Series(0.0002, index=index)
    returns.iloc[150] = -0.25                      # krach d'un seul jour

    result = R.cppi(returns, multiplier=5, floor=0.90, risk_free_rate=0.0)
    breach = result.equity.min() / result.equity.iloc[:150].max()
    assert breach < 0.90, "le plancher doit être traversé — c'est le risque de gap"
