import type { StockItem, Vente, Retour } from "../store/context";

// ---------- TIME ----------
export interface TimeInfo {
  hours: number;
  days: number;
  rawHours: number;
  reliable: boolean;       // >= 2h since publication
  phase: "init" | "heures" | "mix" | "jours" | "vieux";
}

export function getPublicationDate(item: StockItem): Date {
  if (item.datePublication) return new Date(item.datePublication);
  // fallback: createdAt - daysOnline (legacy)
  const base = new Date(item.createdAt || new Date());
  if (item.daysOnline > 0) {
    base.setDate(base.getDate() - item.daysOnline);
  }
  return base;
}

export function timeSincePost(item: StockItem, now: Date = new Date()): TimeInfo {
  const pub = getPublicationDate(item);
  const diffMs = Math.max(0, now.getTime() - pub.getTime());
  const rawHours = diffMs / 3600000;
  const hours = Math.max(1, rawHours);
  const days = Math.max(1, rawHours / 24);
  const reliable = rawHours >= 2;
  let phase: TimeInfo["phase"];
  if (!reliable) phase = "init";
  else if (rawHours < 24) phase = "heures";
  else if (rawHours < 72) phase = "mix";
  else if (rawHours < 120) phase = "jours";
  else phase = "vieux";
  return { hours, days, rawHours, reliable, phase };
}

// ---------- TRACTION ----------
export interface Traction {
  vph: number;   // vues par heure (capped)
  fph: number;   // favoris par heure (capped)
  vpd: number;   // vues par jour
  fpd: number;   // favoris par jour
  ratio: number; // favoris/vues * 100 (0 si vues < 10)
  ratioReliable: boolean;
}

export function computeTraction(item: StockItem, t: TimeInfo): Traction {
  const views = Math.max(0, item.views || 0);
  const favs = Math.max(0, item.favorites || 0);
  const vph = Math.min(50, views / t.hours);
  const fph = Math.min(5, favs / t.hours);
  const vpd = views / t.days;
  const fpd = favs / t.days;
  const ratioReliable = views >= 10;
  const ratio = ratioReliable ? (favs / views) * 100 : 0;
  return { vph, fph, vpd, fpd, ratio, ratioReliable };
}

// ---------- SCORE /100 ----------
export function hybridScore(t: TimeInfo, tr: Traction, item: StockItem): number {
  if (!t.reliable) return 0;
  let s = 0;
  // Heures (60 pts)
  if (tr.vph > 10) s += 30;
  else if (tr.vph > 5) s += 15;
  if (tr.fph > 1) s += 20;
  else if (tr.fph > 0.5) s += 10;
  if (tr.ratioReliable && tr.ratio > 12) s += 10;

  // Jours (40 pts)
  if (tr.vpd > 80) s += 15;
  else if (tr.vpd > 40) s += 7;
  if (tr.fpd > 8) s += 15;
  else if (tr.fpd > 4) s += 7;
  if (item.sold && t.days < 3) s += 10;

  // Adaptation temporelle : pondération douce
  if (t.phase === "heures") {
    // boost heures
    s = Math.round(s * 1.05);
  } else if (t.phase === "vieux") {
    s = Math.round(s * 0.7);
  }

  // Pénalité >5j sans vente
  if (t.days >= 5 && !item.sold) s -= 20;

  return Math.max(0, Math.min(100, Math.round(s)));
}

// ---------- DECISION ----------
export type Action =
  | "ANALYSE"
  | "GARDER"
  | "BAISSER"
  | "BAISSE_IMMEDIATE"
  | "REPOST"
  | "LIQUIDER"
  | "SUPPRIMER";

export function decideAction(
  item: StockItem,
  t: TimeInfo,
  tr: Traction,
  score: number
): Action {
  if (!t.reliable) return "ANALYSE";

  // Produit vieux
  if (t.days >= 21) return "SUPPRIMER";
  if (t.days >= 14) return "LIQUIDER";
  if (t.days >= 7 && tr.vpd < 40) return "LIQUIDER";

  // Beaucoup de fav mais pas de vente
  if ((item.favorites || 0) > 5 && t.days >= 2 && !item.sold) {
    return "BAISSE_IMMEDIATE";
  }

  // Vues élevées + peu de fav
  if (tr.vpd > 60 && tr.ratioReliable && tr.ratio < 3) return "BAISSER";

  // Peu de vues + bon ratio
  if (tr.vpd < 20 && tr.ratioReliable && tr.ratio > 8) return "REPOST";

  // Peu de vues + peu de fav, mais ancien
  if (t.days >= 5 && tr.vpd < 20 && tr.fpd < 1) return "LIQUIDER";

  if (t.days >= 5 && !item.sold && score < 40) return "BAISSER";

  if (score >= 50) return "GARDER";
  if (score >= 25) return "REPOST";
  return "BAISSER";
}

// ---------- BOOST ----------
export type Boost = "BOOST" | "ATTENDRE" | "NO_BOOST";

export function boostRecommendation(
  item: StockItem,
  t: TimeInfo,
  tr: Traction,
  score: number,
  ventes: Vente[]
): { verdict: Boost; reason: string } {
  if (!t.reliable)
    return { verdict: "ATTENDRE", reason: "Pas assez de recul (<2h)" };
  if (t.hours >= 24)
    return { verdict: "NO_BOOST", reason: "Trop tard (>24h)" };

  const viewsOK = (item.views || 0) >= 30;
  const favsOK = (item.favorites || 0) >= 5;
  const ratioOK = tr.ratioReliable && tr.ratio > 12;
  const scoreOK = score >= 45;

  // Prix cohérent : < 2× prix moyen de la marque
  let priceOK = true;
  if (item.brand) {
    const list = ventes.filter(
      (v) => v.brand.toLowerCase() === item.brand.toLowerCase()
    );
    if (list.length) {
      const avg =
        list.reduce((s, v) => s + v.sellPrice, 0) / list.length;
      if (avg > 0 && item.sellPrice > avg * 2) priceOK = false;
    }
  }

  if (viewsOK && favsOK && ratioOK && scoreOK && priceOK) {
    return { verdict: "BOOST", reason: "Traction forte, prix cohérent" };
  }
  if (!viewsOK || !favsOK) {
    return { verdict: "ATTENDRE", reason: "Pas encore assez de traction" };
  }
  if (!ratioOK) {
    return { verdict: "NO_BOOST", reason: "Ratio favoris/vues trop bas" };
  }
  if (!priceOK) {
    return { verdict: "NO_BOOST", reason: "Prix trop élevé vs marché" };
  }
  return { verdict: "ATTENDRE", reason: "Signal mitigé" };
}

// ---------- ANALYSE GLOBALE D'UN ARTICLE ----------
export interface ItemAnalysis {
  time: TimeInfo;
  traction: Traction;
  score: number;
  action: Action;
  boost: { verdict: Boost; reason: string };
  estimatedProfit: number | null; // null si prix_achat inconnu
}

export function analyzeItem(
  item: StockItem,
  ventes: Vente[],
  retours: Retour[]
): ItemAnalysis {
  const time = timeSincePost(item);
  const traction = computeTraction(item, time);
  const score = hybridScore(time, traction, item);

  // Retours pénalité
  let finalScore = score;
  const brandReturns = retours.filter(
    (r) => r.brand.toLowerCase() === (item.brand || "").toLowerCase()
  ).length;
  finalScore = Math.max(0, finalScore - brandReturns * 5);

  const action = decideAction(item, time, traction, finalScore);
  const boost = boostRecommendation(item, time, traction, finalScore, ventes);

  const buy = item.buyPrice;
  const sell = item.sellPrice;
  const fees = item.fees ?? 0;
  const boostCost = item.boostCost ?? 0;
  const estimatedProfit =
    buy && buy > 0 && sell > 0
      ? sell - buy - fees - boostCost
      : null;

  return { time, traction, score: finalScore, action, boost, estimatedProfit };
}

// ---------- VENTES / DASHBOARD ----------
export interface DashboardKpis {
  ca: number;
  benefice: number;
  roi: number; // %
  avgDelay: number;
  stockBlocked: number;
  itemsCount: number;
  toBaisser: number;
  toLiquider: number;
  boostable: number;
}

export function computeDashboard(
  stock: StockItem[],
  ventes: Vente[],
  retours: Retour[]
): DashboardKpis {
  let ca = 0;
  let benefice = 0;
  let cost = 0;
  let delaySum = 0;
  let delayCount = 0;

  ventes.forEach((v) => {
    if (v.sellPrice > 0) ca += v.sellPrice;
    if (v.buyPrice > 0 && v.sellPrice > 0) {
      const fees = v.fees ?? 0;
      const bc = v.boostCost ?? 0;
      benefice += v.sellPrice - v.buyPrice - fees - bc;
      cost += v.buyPrice;
    }
    if (v.delay > 0) {
      delaySum += v.delay;
      delayCount++;
    }
  });

  const roi = cost > 0 ? (benefice / cost) * 100 : 0;
  const avgDelay = delayCount > 0 ? delaySum / delayCount : 0;
  const stockBlocked = stock.reduce((s, x) => s + (x.buyPrice || 0), 0);

  let toBaisser = 0;
  let toLiquider = 0;
  let boostable = 0;
  stock.forEach((s) => {
    const a = analyzeItem(s, ventes, retours);
    if (a.action === "BAISSER" || a.action === "BAISSE_IMMEDIATE") toBaisser++;
    if (a.action === "LIQUIDER" || a.action === "SUPPRIMER") toLiquider++;
    if (a.boost.verdict === "BOOST") boostable++;
  });

  return {
    ca: Math.round(ca * 100) / 100,
    benefice: Math.round(benefice * 100) / 100,
    roi: Math.round(roi * 10) / 10,
    avgDelay: Math.round(avgDelay * 10) / 10,
    stockBlocked: Math.round(stockBlocked * 100) / 100,
    itemsCount: stock.length,
    toBaisser,
    toLiquider,
    boostable,
  };
}

// ---------- DASHBOARD (version depuis analyses pré-calculées) ----------
export function computeDashboardFromAnalyzed(
  analyzed: Array<{ item: StockItem; analysis: ItemAnalysis }>,
  ventes: Vente[]
): DashboardKpis {
  let ca = 0;
  let benefice = 0;
  let cost = 0;
  let delaySum = 0;
  let delayCount = 0;

  ventes.forEach((v) => {
    if (v.sellPrice > 0) ca += v.sellPrice;
    if (v.buyPrice > 0 && v.sellPrice > 0) {
      const fees = v.fees ?? 0;
      const bc = v.boostCost ?? 0;
      benefice += v.sellPrice - v.buyPrice - fees - bc;
      cost += v.buyPrice;
    }
    if (v.delay > 0) {
      delaySum += v.delay;
      delayCount++;
    }
  });

  const roi = cost > 0 ? (benefice / cost) * 100 : 0;
  const avgDelay = delayCount > 0 ? delaySum / delayCount : 0;
  const stockBlocked = analyzed.reduce((s, { item }) => s + (item.buyPrice || 0), 0);

  let toBaisser = 0;
  let toLiquider = 0;
  let boostable = 0;
  analyzed.forEach(({ analysis: a }) => {
    if (a.action === "BAISSER" || a.action === "BAISSE_IMMEDIATE") toBaisser++;
    if (a.action === "LIQUIDER" || a.action === "SUPPRIMER") toLiquider++;
    if (a.boost.verdict === "BOOST") boostable++;
  });

  return {
    ca: Math.round(ca * 100) / 100,
    benefice: Math.round(benefice * 100) / 100,
    roi: Math.round(roi * 10) / 10,
    avgDelay: Math.round(avgDelay * 10) / 10,
    stockBlocked: Math.round(stockBlocked * 100) / 100,
    itemsCount: analyzed.length,
    toBaisser,
    toLiquider,
    boostable,
  };
}

// ---------- BUSINESS HEALTH SCORE ----------
export interface HealthScore {
  score: number; // 0-100
  label: "EXCELLENT" | "BON" | "MOYEN" | "FAIBLE" | "CRITIQUE";
  color: string;
  breakdown: { roi: number; delay: number; deadStock: number; returns: number };
}

export function businessHealthScore(
  kpis: DashboardKpis,
  analyzed: Array<{ analysis: ItemAnalysis }>,
  ventes: Vente[],
  retours: Retour[]
): HealthScore {
  let roiPts = 0, delayPts = 0, deadPts = 0, returnPts = 0;

  if (kpis.roi >= 50) roiPts = 35;
  else if (kpis.roi >= 35) roiPts = 28;
  else if (kpis.roi >= 20) roiPts = 20;
  else if (kpis.roi >= 10) roiPts = 12;
  else if (kpis.roi >= 0) roiPts = 5;

  if (kpis.avgDelay === 0) delayPts = 15;
  else if (kpis.avgDelay <= 5) delayPts = 30;
  else if (kpis.avgDelay <= 10) delayPts = 22;
  else if (kpis.avgDelay <= 14) delayPts = 14;
  else if (kpis.avgDelay <= 21) delayPts = 6;

  const dead = analyzed.filter(
    ({ analysis: a }) => a.action === "SUPPRIMER" || a.action === "LIQUIDER"
  ).length;
  const deadRate = analyzed.length > 0 ? dead / analyzed.length : 0;
  if (deadRate === 0) deadPts = 20;
  else if (deadRate < 0.1) deadPts = 16;
  else if (deadRate < 0.2) deadPts = 10;
  else if (deadRate < 0.4) deadPts = 4;

  const retRate = ventes.length > 0 ? retours.length / ventes.length : 0;
  if (retRate === 0) returnPts = 15;
  else if (retRate < 0.05) returnPts = 12;
  else if (retRate < 0.1) returnPts = 7;
  else if (retRate < 0.2) returnPts = 3;

  const score = roiPts + delayPts + deadPts + returnPts;
  const label =
    score >= 80
      ? "EXCELLENT"
      : score >= 60
      ? "BON"
      : score >= 40
      ? "MOYEN"
      : score >= 25
      ? "FAIBLE"
      : "CRITIQUE";

  const color =
    score >= 80
      ? "#39FF14"
      : score >= 60
      ? "#7CFC00"
      : score >= 40
      ? "#FF9900"
      : score >= 25
      ? "#FF6B35"
      : "#FF3366";

  return { score, label, color, breakdown: { roi: roiPts, delay: delayPts, deadStock: deadPts, returns: returnPts } };
}

// ---------- SOURCING (amélioré) ----------
const STRONG_CATEGORIES = [
  "carhartt",
  "dickies",
  "cargo",
  "workwear",
  "levi",
  "levis",
  "patagonia",
];
const WEAK_CATEGORIES = [
  "hoodie",
  "legging",
  "leggings",
  "shein",
  "primark",
];

export type Sourcing =
  | "ACHETER"
  | "OK"
  | "NEGOCIER"
  | "REFUSER"
  | "DONNEES_INSUFFISANTES";

export interface SourcingResult {
  verdict: Sourcing;
  score: number;
  avgSell: number;
  profit: number | null;
  sampleSize: number;
  reason: string;
  categoryBonus: number;
}

function matchTag(text: string, tags: string[]): boolean {
  const t = text.toLowerCase();
  return tags.some((x) => t.includes(x));
}

export function sourcingAnalyze(
  brand: string,
  category: string,
  buyPrice: number,
  ventes: Vente[],
  fees: number = 0
): SourcingResult {
  const brandLc = brand.trim().toLowerCase();
  const matches = ventes.filter(
    (v) => v.brand.toLowerCase() === brandLc && v.sellPrice > 0
  );
  const sampleSize = matches.length;

  const blob = `${brand} ${category}`;
  const isStrong = matchTag(blob, STRONG_CATEGORIES);
  const isWeak = matchTag(blob, WEAK_CATEGORIES);
  const categoryBonus = isStrong ? 40 : isWeak ? -10 : 20;

  if (sampleSize === 0) {
    return {
      verdict: "DONNEES_INSUFFISANTES",
      score: 0,
      avgSell: 0,
      profit: null,
      sampleSize: 0,
      reason: "Pas d'historique de vente pour cette marque",
      categoryBonus,
    };
  }

  const avgSell =
    matches.reduce((s, v) => s + v.sellPrice, 0) / sampleSize;
  const profit = avgSell - buyPrice - fees;

  // Score sourcing /100
  // marge 40 | catégorie 40 | rotation 20
  let margeScore = 0;
  if (profit > 20) margeScore = 40;
  else if (profit > 10) margeScore = 30;
  else if (profit > 5) margeScore = 20;
  else if (profit > 0) margeScore = 10;
  else margeScore = 0;

  const avgDelay =
    matches.reduce((s, v) => s + (v.delay || 0), 0) / sampleSize;
  let rotationScore = 0;
  if (avgDelay > 0 && avgDelay < 3) rotationScore = 20;
  else if (avgDelay < 7) rotationScore = 14;
  else if (avgDelay < 14) rotationScore = 8;
  else rotationScore = 0;

  const score = Math.max(
    0,
    Math.min(100, margeScore + categoryBonus + rotationScore)
  );

  let verdict: Sourcing;
  let reason: string;
  if (profit < 0) {
    verdict = "REFUSER";
    reason = `Marge négative (${profit.toFixed(1)}€)`;
  } else if (profit < 5) {
    verdict = "NEGOCIER";
    reason = `Marge trop faible (${profit.toFixed(1)}€) — négocie le prix`;
  } else if (profit < 10) {
    verdict = isStrong ? "ACHETER" : "OK";
    reason = `Marge correcte (${profit.toFixed(1)}€)`;
  } else {
    verdict = "ACHETER";
    reason = `Belle marge (${profit.toFixed(1)}€)${isStrong ? " + catégorie forte" : ""}`;
  }

  return {
    verdict,
    score,
    avgSell: Math.round(avgSell * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    sampleSize,
    reason,
    categoryBonus,
  };
}
