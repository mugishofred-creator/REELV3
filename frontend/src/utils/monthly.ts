import type { Vente } from "../store/context";

export interface MonthStat {
  key: string; // YYYY-MM
  label: string;
  count: number;
  revenue: number;
  profit: number;
  avgDelay: number;
  roi: number; // profit / cost
}

const MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

export function computeMonthlyStats(ventes: Vente[]): MonthStat[] {
  const map = new Map<string, Vente[]>();
  ventes.forEach((v) => {
    const d = new Date(v.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(v);
  });
  const res: MonthStat[] = [];
  map.forEach((list, key) => {
    const revenue = list.reduce((s, v) => s + v.sellPrice, 0);
    const cost = list.reduce((s, v) => s + v.buyPrice, 0);
    const profit = revenue - cost;
    const avgDelay =
      list.reduce((s, v) => s + (v.delay || 0), 0) / Math.max(1, list.length);
    const [y, m] = key.split("-");
    res.push({
      key,
      label: `${MONTHS[Number(m) - 1]} ${y}`,
      count: list.length,
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      avgDelay: Math.round(avgDelay * 10) / 10,
      roi: cost > 0 ? Math.round((profit / cost) * 100) / 100 : 0,
    });
  });
  return res.sort((a, b) => (a.key < b.key ? 1 : -1));
}
