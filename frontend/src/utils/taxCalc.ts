// Auto-entrepreneur 2024 — Vente de marchandises (micro-BIC)

export type TaxResult = {
  ca: number;
  cotisations: number;
  cfp: number;
  totalCharges: number;
  revenuImposable: number;
  irEstime: number;
  netAvantIR: number;
  netApresIR: number;
  tauxEffectif: number;
};

export type Periode = "mensuel" | "annuel";

const COTISATIONS = 0.123;
const CFP = 0.001;
const ABATTEMENT = 0.71;

const IR_TRANCHES = [
  { min: 0,       max: 11_294,  rate: 0 },
  { min: 11_294,  max: 28_797,  rate: 0.11 },
  { min: 28_797,  max: 82_341,  rate: 0.30 },
  { min: 82_341,  max: 177_106, rate: 0.41 },
  { min: 177_106, max: Infinity, rate: 0.45 },
];

function estimateIR(revenuImposable: number, parts: number): number {
  const qi = revenuImposable / parts;
  let ir = 0;
  for (const t of IR_TRANCHES) {
    if (qi <= t.min) break;
    ir += (Math.min(qi, t.max) - t.min) * t.rate;
  }
  return ir * parts;
}

export function computeTax(ca: number, parts: number = 1): TaxResult {
  const cotisations = ca * COTISATIONS;
  const cfp = ca * CFP;
  const totalCharges = cotisations + cfp;
  const revenuImposable = ca * (1 - ABATTEMENT);
  const irEstime = estimateIR(revenuImposable, parts);
  const netAvantIR = ca - totalCharges;
  const netApresIR = netAvantIR - irEstime;
  const tauxEffectif = ca > 0 ? ((totalCharges + irEstime) / ca) * 100 : 0;

  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    ca: r(ca),
    cotisations: r(cotisations),
    cfp: r(cfp),
    totalCharges: r(totalCharges),
    revenuImposable: r(revenuImposable),
    irEstime: r(irEstime),
    netAvantIR: r(netAvantIR),
    netApresIR: r(netApresIR),
    tauxEffectif: Math.round(tauxEffectif * 10) / 10,
  };
}

export const SEUILS = {
  franchiseTVA: 85_000,
  plafondCA: 188_700,
  versementLiberatoire: 27_794, // revenu fiscal N-2 max pour opter
};
