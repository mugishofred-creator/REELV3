import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SniperRule = {
  id: string;
  name: string;
  keywords: string;
  maxPrice: number;
  enabled: boolean;
  createdAt: string;
  hitsCount: number;
};

export type SniperHit = {
  id: string;
  ruleId: string;
  ruleName: string;
  title: string;
  price: number;
  brand: string;
  photo: string;
  detectedAt: string;
  vintedUrl: string;
};

// ── Storage keys ──────────────────────────────────────────────────────────────

const RULES_KEY = "vm:sniperRules";
const HITS_KEY = "vm:sniperHits";
const SEEN_KEY = "vm:sniperSeenIds";

// ── In-memory seen IDs (O(1) lookup, never re-alert same listing) ─────────────

let seenIds = new Set<string>();
let seenLoaded = false;

export async function initSeenIds(): Promise<void> {
  if (seenLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    seenIds = new Set(arr);
  } catch {
    seenIds = new Set();
  }
  seenLoaded = true;
}

async function flushSeenIds(): Promise<void> {
  const arr = Array.from(seenIds).slice(-3000);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(arr));
}

// ── Rules CRUD ────────────────────────────────────────────────────────────────

export async function loadRules(): Promise<SniperRule[]> {
  const raw = await AsyncStorage.getItem(RULES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveRules(rules: SniperRule[]): Promise<void> {
  await AsyncStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export async function addRule(rule: Omit<SniperRule, "id" | "createdAt" | "hitsCount">): Promise<SniperRule[]> {
  const rules = await loadRules();
  const newRule: SniperRule = {
    ...rule,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    hitsCount: 0,
  };
  const updated = [...rules, newRule];
  await saveRules(updated);
  return updated;
}

export async function deleteRule(id: string): Promise<SniperRule[]> {
  const rules = await loadRules();
  const updated = rules.filter((r) => r.id !== id);
  await saveRules(updated);
  return updated;
}

export async function toggleRule(id: string): Promise<SniperRule[]> {
  const rules = await loadRules();
  const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
  await saveRules(updated);
  return updated;
}

// ── Hits (deal history) ───────────────────────────────────────────────────────

export async function loadHits(): Promise<SniperHit[]> {
  const raw = await AsyncStorage.getItem(HITS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function appendHits(newHits: SniperHit[]): Promise<void> {
  const existing = await loadHits();
  const merged = [...newHits, ...existing].slice(0, 100);
  await AsyncStorage.setItem(HITS_KEY, JSON.stringify(merged));
}

export async function clearHits(): Promise<void> {
  await AsyncStorage.removeItem(HITS_KEY);
}

// ── Vinted direct search (newest first, price capped) ─────────────────────────
// Fastest strategy: fetch only 20 newest items, check price, skip seen IDs.


const VINTED_BASE = "https://www.vinted.fr/api/v2";

function parsePrice(raw: unknown): number {
  if (raw && typeof raw === "object" && "amount" in raw) {
    return parseFloat((raw as { amount: string }).amount) || 0;
  }
  return parseFloat(String(raw ?? 0)) || 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchNewest(keywords: string, maxPrice: number): Promise<unknown[]> {
  const qs = `search_text=${encodeURIComponent(keywords)}&price_to=${maxPrice}&per_page=20&order=newest_first`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${VINTED_BASE}/catalog/items?${qs}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data as { items?: unknown[] }).items ?? [];
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Core check: run all active rules in parallel ──────────────────────────────

export async function runSniperCheck(rules: SniperRule[]): Promise<SniperHit[]> {
  await initSeenIds();

  const activeRules = rules.filter((r) => r.enabled);
  if (activeRules.length === 0) return [];

  const newHits: SniperHit[] = [];
  const updatedRules = [...rules];

  for (const rule of activeRules) {
    try {
      // Random delay 2–5s between rules to avoid bot detection
      await delay(2000 + Math.random() * 3000);
      const items = await searchNewest(rule.keywords, rule.maxPrice);
        for (const raw of items as Record<string, unknown>[]) {
          const id = String(raw.id ?? "");
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);

          const price = parsePrice(raw.price);
          if (price <= 0 || price > rule.maxPrice) continue;

          const photos =
            (raw.photos as { url?: string; full_size_url?: string }[] | undefined) ?? [];
          const photo = photos[0]?.url ?? photos[0]?.full_size_url ?? "";
          const vintedUrl = `https://www.vinted.fr/items/${id}`;

          newHits.push({
            id,
            ruleId: rule.id,
            ruleName: rule.name,
            title: String(raw.title ?? ""),
            price,
            brand: String(raw.brand_title ?? ""),
            photo,
            detectedAt: new Date().toISOString(),
            vintedUrl,
          });

          // increment hitsCount on the rule
          const idx = updatedRules.findIndex((r) => r.id === rule.id);
          if (idx !== -1) updatedRules[idx] = { ...updatedRules[idx], hitsCount: updatedRules[idx].hitsCount + 1 };
      }
    } catch {
      // per-rule errors are silent — don't block other rules
    }
  }

  if (newHits.length > 0) {
    await Promise.all([
      flushSeenIds(),
      appendHits(newHits),
      saveRules(updatedRules),
      sendSniperNotifications(newHits),
    ]);
  }

  return newHits;
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function sendSniperNotifications(hits: SniperHit[]): Promise<void> {
  for (const hit of hits) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🎯 SNIPER — ${hit.price}€ !`,
        body: `${hit.title}${hit.brand ? ` · ${hit.brand}` : ""} — règle « ${hit.ruleName} »`,
        sound: true,
        // @ts-ignore android-specific
        priority: "max",
        vibrate: [0, 250, 250, 250],
        data: { url: hit.vintedUrl },
      },
      trigger: null,
    });
  }
}
