import type { StockItem, Vente } from "../store/context";
import type { ItemAnalysis } from "./analytics";

export function saleProbability(
  item: StockItem,
  ventes: Vente[],
  analysis: ItemAnalysis
): number {
  const brandSales = ventes.filter(
    (v) => v.brand.toLowerCase() === (item.brand || "").toLowerCase()
  );

  let prob = Math.max(5, analysis.score);

  if (brandSales.length >= 2) {
    const avgSell =
      brandSales.reduce((s, v) => s + v.sellPrice, 0) / brandSales.length;
    const avgDelay =
      brandSales.reduce((s, v) => s + (v.delay || 0), 0) / brandSales.length;

    if (avgSell > 0) {
      const ratio = item.sellPrice / avgSell;
      if (ratio > 1.5) prob -= 30;
      else if (ratio > 1.25) prob -= 15;
      else if (ratio < 0.8) prob += 10;
    }
    if (avgDelay > 0 && analysis.time.days > avgDelay) {
      const overshoot = analysis.time.days / avgDelay;
      if (overshoot > 2) prob -= 20;
      else if (overshoot > 1.5) prob -= 12;
    }
  }

  if (analysis.action === "GARDER") prob = Math.max(prob, 60);
  if (analysis.action === "SUPPRIMER") prob = Math.min(prob, 15);
  if (analysis.action === "LIQUIDER") prob = Math.min(prob, 30);
  if (analysis.action === "BAISSE_IMMEDIATE") prob = Math.min(prob, 45);

  return Math.round(Math.min(97, Math.max(3, prob)));
}

export function probColor(prob: number): string {
  if (prob >= 70) return "#39FF14";
  if (prob >= 45) return "#FF9900";
  return "#FF3366";
}

export function probLabel(prob: number): string {
  if (prob >= 70) return "Fort";
  if (prob >= 45) return "Moyen";
  return "Faible";
}
