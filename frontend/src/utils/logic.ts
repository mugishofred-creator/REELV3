import type { StockItem, Vente, Retour } from "../store/context";
import { timeSincePost } from "./analytics";

// ---------- SEASON ----------
export function detectSeason(category: string): "ete" | "hiver" | "toute" {
  const c = (category || "").toLowerCase();
  if (/(short|t[- ]?shirt|tshirt|tee|debardeur|robe|maillot)/.test(c))
    return "ete";
  if (/(hoodie|pull|manteau|doudoune|veste|sweat|écharpe|echarpe|gant|bonnet)/.test(c))
    return "hiver";
  if (/(pant|jean|pantalon|chino)/.test(c)) return "toute";
  return "toute";
}

export function currentSeason(): "ete" | "hiver" {
  const m = new Date().getMonth() + 1;
  return m >= 4 && m <= 9 ? "ete" : "hiver";
}

export function seasonBonus(itemSeason: string): number {
  if (itemSeason === "toute") return 2;
  const now = currentSeason();
  return itemSeason === now ? 8 : -8;
}

// ---------- SCORE ----------
export function computeScore(item: StockItem, retours: Retour[]): number {
  const profit = (item.sellPrice || 0) - (item.buyPrice || 0);
  const base =
    (item.favorites || 0) * 2 -
    (item.views || 0) / 10 +
    profit -
    (item.daysOnline || 0) * 2 -
    (item.defect ? 10 : 0) +
    seasonBonus(item.season);

  const brandReturns = retours.filter(
    (r) => r.brand.toLowerCase() === item.brand.toLowerCase()
  ).length;
  const penalty = brandReturns * 3;
  return Math.round(base - penalty);
}

// ---------- DECISION ----------
export type Decision = "SUPPRIMER" | "BAISSER" | "GARDER" | "LIQUIDER";

export function computeDecision(item: StockItem, score: number): Decision {
  if (item.daysOnline >= 21) return "SUPPRIMER";
  if (item.daysOnline >= 14) return "LIQUIDER";
  if (item.daysOnline >= 7) return "BAISSER";
  if (score < 0) return "SUPPRIMER";
  if (score < 10) return "BAISSER";
  return "GARDER";
}

// ---------- REPOST ----------
export function shouldRepost(item: StockItem): boolean {
  return item.daysOnline > 7 && (item.favorites || 0) < 2;
}

export function forceDelete(item: StockItem): boolean {
  return (item.repostCount || 0) >= 3;
}

// ---------- LISTING ANALYSIS ----------
export type ListingFlag = "MAUVAISE ANNONCE" | "PRIX TROP ÉLEVÉ" | null;

export function listingFlag(item: StockItem): ListingFlag {
  if ((item.views || 0) > 100 && (item.favorites || 0) === 0)
    return "MAUVAISE ANNONCE";
  if ((item.favorites || 0) > 5 && item.daysOnline >= 7)
    return "PRIX TROP ÉLEVÉ";
  return null;
}

export function conversionRate(item: StockItem): number {
  if (!item.views) return 0;
  return (item.sold ? 1 : 0) / item.views;
}

// ---------- PRICE SUGGESTION ----------
export function avgSellByBrand(ventes: Vente[], brand: string): number {
  const list = ventes.filter(
    (v) => v.brand.toLowerCase() === brand.toLowerCase()
  );
  if (!list.length) return 0;
  return list.reduce((s, v) => s + (v.sellPrice || 0), 0) / list.length;
}

export function avgDelayByBrand(ventes: Vente[], brand: string): number {
  const list = ventes.filter(
    (v) => v.brand.toLowerCase() === brand.toLowerCase()
  );
  if (!list.length) return 0;
  return list.reduce((s, v) => s + (v.delay || 0), 0) / list.length;
}

export function suggestedPrice(item: StockItem, ventes: Vente[]): number {
  const avg = avgSellByBrand(ventes, item.brand);
  let base = avg > 0 ? avg : item.sellPrice;
  if (item.daysOnline >= 14) base = base * 0.8;
  else if (item.daysOnline >= 7) base = base * 0.9;
  return Math.round(base * 100) / 100;
}

// ---------- SOURCING ----------
export type SourcingVerdict =
  | "ACHAT FORT"
  | "ACHETER"
  | "NÉGOCIER"
  | "IGNORE";

export function sourcingRecommendation(
  brand: string,
  category: string,
  buyPrice: number,
  ventes: Vente[]
): {
  verdict: SourcingVerdict;
  avgSell: number;
  avgDelay: number;
  profit: number;
  ratio: number;
} {
  const avgSell = avgSellByBrand(ventes, brand);
  const avgDelay = avgDelayByBrand(ventes, brand);
  const profit = avgSell - buyPrice;
  const ratio = avgSell > 0 ? buyPrice / avgSell : 1;

  let verdict: SourcingVerdict;
  if (avgSell === 0) verdict = "NÉGOCIER";
  else if (profit < 5) verdict = "IGNORE";
  else if (ratio < 0.4) verdict = "ACHAT FORT";
  else if (ratio < 0.6) verdict = "ACHETER";
  else if (ratio < 0.8) verdict = "NÉGOCIER";
  else verdict = "IGNORE";

  return { verdict, avgSell, avgDelay, profit, ratio };
}

// ---------- NICHES ----------
export interface NicheStats {
  brand: string;
  count: number;
  avgProfit: number;
  avgDelay: number;
  successRate: number;
  score: number;
}

export function computeNiches(ventes: Vente[]): NicheStats[] {
  const byBrand = new Map<string, Vente[]>();
  ventes.forEach((v) => {
    const k = v.brand.toLowerCase();
    if (!byBrand.has(k)) byBrand.set(k, []);
    byBrand.get(k)!.push(v);
  });
  const res: NicheStats[] = [];
  byBrand.forEach((list, brand) => {
    const profits = list.map((v) => (v.sellPrice || 0) - (v.buyPrice || 0));
    const avgProfit =
      profits.reduce((a, b) => a + b, 0) / Math.max(1, profits.length);
    const avgDelay =
      list.reduce((s, v) => s + (v.delay || 0), 0) / Math.max(1, list.length);
    const profitable = profits.filter((p) => p > 0).length;
    const successRate = profitable / Math.max(1, list.length);
    const score =
      (avgProfit / Math.max(1, avgDelay)) * successRate * 10;
    res.push({
      brand,
      count: list.length,
      avgProfit: Math.round(avgProfit * 100) / 100,
      avgDelay: Math.round(avgDelay * 10) / 10,
      successRate: Math.round(successRate * 100) / 100,
      score: Math.round(score * 100) / 100,
    });
  });
  return res.sort((a, b) => b.score - a.score);
}

// ---------- GLOBAL ERRORS ----------
export function globalWarnings(
  stock: StockItem[],
  retours: Retour[]
): string[] {
  const warnings: string[] = [];
  const dead = stock.filter((s) => timeSincePost(s).days >= 21).length;
  if (dead >= 3) warnings.push("TU ACHÈTES MAL — trop de stock mort");
  if (retours.length >= 3)
    warnings.push("MAUVAISE DESCRIPTION — trop de retours");
  const weak = stock.filter((s) => listingFlag(s)).length;
  if (weak >= 3) warnings.push("ANNONCES FAIBLES — revois tes annonces");
  return warnings;
}
