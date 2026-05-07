import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "vm:marketHistory";
const MAX_ENTRIES = 200;

export interface MarketSnapshot {
  brand: string;
  category: string;
  query: string;
  date: string;   // ISO
  median: number;
  average: number;
  count: number;
}

// ── Persistence ───────────────────────────────────────────────────────────────

async function loadAll(): Promise<MarketSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MarketSnapshot[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(list: MarketSnapshot[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export async function saveMarketSnapshot(snap: Omit<MarketSnapshot, "date">): Promise<void> {
  const all = await loadAll();
  const entry: MarketSnapshot = { ...snap, date: new Date().toISOString() };
  // Keep only the latest entry per brand+category pair + history cap
  const filtered = all.filter(
    (s) => !(s.brand.toLowerCase() === snap.brand.toLowerCase() &&
             s.category.toLowerCase() === snap.category.toLowerCase() &&
             // remove duplicates within the same day
             s.date.slice(0, 10) === entry.date.slice(0, 10))
  );
  const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
  await saveAll(next);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBrandTrend(
  brand: string,
  category: string,
  limit = 6
): Promise<MarketSnapshot[]> {
  const all = await loadAll();
  return all
    .filter(
      (s) =>
        s.brand.toLowerCase() === brand.toLowerCase() &&
        s.category.toLowerCase() === category.toLowerCase()
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .reverse(); // oldest → newest for the chart
}

export interface PriceDropAlert {
  drop: number;       // absolute € drop
  dropPct: number;    // percentage
  previous: number;
  current: number;
  daysAgo: number;
}

export async function detectPriceDrop(
  brand: string,
  category: string,
  currentMedian: number
): Promise<PriceDropAlert | null> {
  const trend = await getBrandTrend(brand, category, 6);
  if (trend.length < 1) return null;

  // Find the most recent *previous* snapshot (not today)
  const today = new Date().toISOString().slice(0, 10);
  const previous = trend.filter((s) => s.date.slice(0, 10) !== today).at(-1);
  if (!previous || previous.median <= 0) return null;

  const drop = previous.median - currentMedian;
  const dropPct = (drop / previous.median) * 100;
  if (dropPct < 8) return null; // only alert if ≥ 8% drop

  const daysAgo = Math.round(
    (Date.now() - new Date(previous.date).getTime()) / 86400000
  );

  return {
    drop: Math.round(drop * 10) / 10,
    dropPct: Math.round(dropPct),
    previous: previous.median,
    current: currentMedian,
    daysAgo,
  };
}

// ── Best publish hours (from ventes) ─────────────────────────────────────────

export interface HourStat {
  hour: number;
  count: number;
  label: string;
}

export function computeBestHours(
  venteDates: string[],
  topN = 5
): HourStat[] {
  const counts: Record<number, number> = {};
  for (const d of venteDates) {
    const h = new Date(d).getHours();
    counts[h] = (counts[h] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([h, count]) => ({
      hour: Number(h),
      count,
      label: `${h}h–${Number(h) + 1}h`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
