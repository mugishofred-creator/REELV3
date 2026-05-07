import AsyncStorage from "@react-native-async-storage/async-storage";
import { directFetchUserItems } from "./vintedDirect";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompetitorItem = {
  id: string;
  title: string;
  price: number;
  brand: string;
  photoUrl: string;
};

export type Competitor = {
  id: string;
  vintedId: string;
  username: string;
  addedAt: string;
  lastChecked: string | null;
  currentItems: CompetitorItem[];
  newCount: number;
  removedCount: number;
  avgPrice: number;
  topBrand: string;
};

const KEY = "vm:competitors";

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function loadCompetitors(): Promise<Competitor[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveCompetitors(list: Competitor[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function addCompetitor(vintedId: string, username: string): Promise<Competitor[]> {
  const list = await loadCompetitors();
  if (list.some((c) => c.vintedId === vintedId)) return list;
  const newC: Competitor = {
    id: Date.now().toString(),
    vintedId,
    username,
    addedAt: new Date().toISOString(),
    lastChecked: null,
    currentItems: [],
    newCount: 0,
    removedCount: 0,
    avgPrice: 0,
    topBrand: "",
  };
  const updated = [...list, newC];
  await saveCompetitors(updated);
  return updated;
}

export async function removeCompetitor(id: string): Promise<Competitor[]> {
  const list = await loadCompetitors();
  const updated = list.filter((c) => c.id !== id);
  await saveCompetitors(updated);
  return updated;
}

// ── Refresh (fetch latest items + compute diff) ───────────────────────────────

export async function refreshCompetitor(id: string): Promise<Competitor[]> {
  const list = await loadCompetitors();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return list;

  const comp = list[idx];
  const fetched = await directFetchUserItems(comp.vintedId);

  const prevIds = new Set(comp.currentItems.map((i) => i.id));
  const newIds = new Set(fetched.map((i) => i.id));

  const newCount = fetched.filter((i) => !prevIds.has(i.id)).length;
  const removedCount = comp.currentItems.filter((i) => !newIds.has(i.id)).length;

  const prices = fetched.map((i) => i.price).filter((p) => p > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const brandCount: Record<string, number> = {};
  fetched.forEach((i) => { if (i.brand) brandCount[i.brand] = (brandCount[i.brand] ?? 0) + 1; });
  const topBrand = Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const updated = [...list];
  updated[idx] = {
    ...comp,
    lastChecked: new Date().toISOString(),
    currentItems: fetched.map((i) => ({ id: i.id, title: i.title, price: i.price, brand: i.brand, photoUrl: i.photoUrl })),
    newCount,
    removedCount,
    avgPrice: Math.round(avgPrice * 100) / 100,
    topBrand,
  };
  await saveCompetitors(updated);
  return updated;
}
