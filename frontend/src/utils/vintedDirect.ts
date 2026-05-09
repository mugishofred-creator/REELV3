import { getAuthHeaders } from "./vintedAuth";

const VINTED_BASE = "https://www.vinted.fr/api/v2";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DirectMarketData {
  query: string;
  count: number;
  median: number;
  average: number;
  min: number;
  max: number;
  samples: { title: string; price: number; brand: string; photo: string }[];
}

export interface DirectVintedItem {
  id: string;
  title: string;
  price: number;
  brand: string;
  category: string;
  photoUrl: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePrice(raw: unknown): number {
  if (raw && typeof raw === "object" && "amount" in raw) {
    return parseFloat((raw as { amount: string }).amount) || 0;
  }
  return parseFloat(String(raw ?? 0)) || 0;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((p) => p >= lo && p <= hi);
}

async function vintedGet(path: string, params: Record<string, string | number>): Promise<unknown> {
  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
  const url = `${VINTED_BASE}${path}?${qs}`;

  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Vinted ${res.status}`);
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Market price ──────────────────────────────────────────────────────────────

export async function directFetchMarketPrice(
  brand: string,
  category: string
): Promise<DirectMarketData> {
  const query = `${brand} ${category}`.trim();

  const data = await vintedGet("/catalog/items", {
    search_text: query,
    per_page: 96,
    page: 1,
    order: "relevance",
  }) as { items?: unknown[] };

  const items = data.items ?? [];
  const prices: number[] = [];
  const samples: DirectMarketData["samples"] = [];

  for (const item of items as Record<string, unknown>[]) {
    const price = parsePrice(item.price);
    if (price <= 0) continue;
    prices.push(price);

    if (samples.length < 12) {
      const photos = (item.photos as { url?: string; full_size_url?: string }[] | undefined) ?? [];
      const photo = photos[0]?.url ?? photos[0]?.full_size_url ?? "";
      samples.push({
        title: String(item.title ?? ""),
        price,
        brand: String(item.brand_title ?? ""),
        photo,
      });
    }
  }

  if (prices.length === 0) {
    return { query, count: 0, median: 0, average: 0, min: 0, max: 0, samples: [] };
  }

  const filtered = removeOutliers(prices);
  const pool = filtered.length > 0 ? filtered : prices;
  const avg = pool.reduce((a, b) => a + b, 0) / pool.length;

  return {
    query,
    count: pool.length,
    median: Math.round(median(pool) * 100) / 100,
    average: Math.round(avg * 100) / 100,
    min: Math.round(Math.min(...pool) * 100) / 100,
    max: Math.round(Math.max(...pool) * 100) / 100,
    samples,
  };
}

// ── User catalogue ────────────────────────────────────────────────────────────

export async function directFetchUserItems(userId: string): Promise<DirectVintedItem[]> {
  const allItems: DirectVintedItem[] = [];
  let page = 1;

  while (page <= 5) {
    const data = await vintedGet("/catalog/items", {
      user_id: userId,
      page,
      per_page: 96,
      order: "newest_first",
    }) as { items?: unknown[]; pagination?: { total_pages?: number } };

    const batch = (data.items ?? []) as Record<string, unknown>[];
    if (batch.length === 0) break;

    for (const item of batch) {
      const photos = (item.photos as { url?: string; full_size_url?: string }[] | undefined) ?? [];
      const photoUrl = photos[0]?.url ?? photos[0]?.full_size_url ?? "";
      allItems.push({
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        price: parsePrice(item.price),
        brand: String(item.brand_title ?? ""),
        category: String(item.category_title ?? ""),
        photoUrl,
        status: String(item.status ?? ""),
      });
    }

    const totalPages = data.pagination?.total_pages ?? 1;
    if (page >= totalPages) break;
    page++;
  }

  return allItems;
}
