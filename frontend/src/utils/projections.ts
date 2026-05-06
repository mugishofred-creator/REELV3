import type { StockItem, Vente } from "../store/context";
import type { ItemAnalysis } from "./analytics";
import { saleProbability } from "./saleProbability";

export interface ProjectionResult {
  projectedCA: number;
  projectedProfit: number;
  projectedSales: number;
  avgProbability: number;
  highConfidenceCount: number;
}

export interface PeriodStats {
  revenue: number;
  profit: number;
  count: number;
}

export function computeProjections(
  analyzed: Array<{ item: StockItem; analysis: ItemAnalysis }>,
  ventes: Vente[]
): ProjectionResult {
  if (analyzed.length === 0) {
    return {
      projectedCA: 0,
      projectedProfit: 0,
      projectedSales: 0,
      avgProbability: 0,
      highConfidenceCount: 0,
    };
  }

  let ca = 0,
    profit = 0,
    totalProbPct = 0,
    sales = 0,
    high = 0;

  analyzed.forEach(({ item, analysis }) => {
    const prob = saleProbability(item, ventes, analysis) / 100;
    const fees = item.fees ?? 0;
    const bc = item.boostCost ?? 0;
    ca += item.sellPrice * prob;
    profit += (item.sellPrice - item.buyPrice - fees - bc) * prob;
    totalProbPct += prob * 100;
    sales += prob;
    if (prob >= 0.7) high++;
  });

  return {
    projectedCA: Math.round(ca * 100) / 100,
    projectedProfit: Math.round(profit * 100) / 100,
    projectedSales: Math.round(sales * 10) / 10,
    avgProbability: Math.round(totalProbPct / analyzed.length),
    highConfidenceCount: high,
  };
}

export function computeSaleStreak(ventes: Vente[]): number {
  if (ventes.length === 0) return 0;
  const dates = new Set<number>();
  ventes.forEach((v) => {
    const d = new Date(v.date);
    d.setHours(0, 0, 0, 0);
    dates.add(d.getTime());
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(today);
  if (!dates.has(check.getTime())) check.setDate(check.getDate() - 1);
  let streak = 0;
  while (dates.has(check.getTime())) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

export function currentMonthStats(ventes: Vente[]): PeriodStats {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const month = ventes.filter((v) => new Date(v.date).getTime() >= start);
  return {
    revenue: month.reduce((s, v) => s + v.sellPrice, 0),
    profit: month.reduce(
      (s, v) =>
        s + v.sellPrice - v.buyPrice - (v.fees || 0) - (v.boostCost || 0),
      0
    ),
    count: month.length,
  };
}

export function lastSevenDaysStats(ventes: Vente[]): PeriodStats {
  const cutoff = Date.now() - 7 * 86400000;
  const week = ventes.filter((v) => new Date(v.date).getTime() >= cutoff);
  return {
    revenue: week.reduce((s, v) => s + v.sellPrice, 0),
    profit: week.reduce(
      (s, v) =>
        s + v.sellPrice - v.buyPrice - (v.fees || 0) - (v.boostCost || 0),
      0
    ),
    count: week.length,
  };
}

export interface VentesRecords {
  fastestSale: { name: string; brand: string; delay: number } | null;
  bestMargin: { name: string; brand: string; profit: number } | null;
  bestBrand: { brand: string; avgProfit: number; count: number } | null;
}

export function computeRecords(ventes: Vente[]): VentesRecords {
  if (ventes.length === 0)
    return { fastestSale: null, bestMargin: null, bestBrand: null };

  const withProfit = ventes.map((v) => ({
    ...v,
    profit: v.sellPrice - v.buyPrice - (v.fees || 0) - (v.boostCost || 0),
  }));

  const sold = withProfit.filter((v) => v.delay > 0);
  const fastest = sold.length
    ? sold.reduce((a, b) => (a.delay < b.delay ? a : b))
    : null;

  const best = withProfit.reduce((a, b) => (a.profit > b.profit ? a : b));

  const byBrand = new Map<string, number[]>();
  withProfit.forEach((v) => {
    const k = v.brand.toLowerCase();
    if (!byBrand.has(k)) byBrand.set(k, []);
    byBrand.get(k)!.push(v.profit);
  });

  let bestBrand: VentesRecords["bestBrand"] = null;
  byBrand.forEach((profits, brand) => {
    if (profits.length < 2) return;
    const avg = profits.reduce((a, b) => a + b, 0) / profits.length;
    if (!bestBrand || avg > bestBrand.avgProfit) {
      bestBrand = { brand, avgProfit: Math.round(avg * 100) / 100, count: profits.length };
    }
  });

  return {
    fastestSale: fastest
      ? { name: fastest.name, brand: fastest.brand, delay: fastest.delay }
      : null,
    bestMargin: { name: best.name, brand: best.brand, profit: best.profit },
    bestBrand,
  };
}
