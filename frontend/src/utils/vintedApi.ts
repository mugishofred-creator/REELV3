import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL_KEY = "vm:backendUrl";
const VINTED_USER_ID_KEY = "vm:vintedUserId";
export const DEFAULT_BACKEND = "http://localhost:8001";

// ── Backend URL config ────────────────────────────────────────────────────────

export async function getBackendUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(BACKEND_URL_KEY);
    return stored?.trim() || DEFAULT_BACKEND;
  } catch {
    return DEFAULT_BACKEND;
  }
}

export async function saveBackendUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(BACKEND_URL_KEY, url.trim());
}

export async function getSavedVintedUserId(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(VINTED_USER_ID_KEY)) || "";
  } catch {
    return "";
  }
}

export async function saveVintedUserId(id: string): Promise<void> {
  await AsyncStorage.setItem(VINTED_USER_ID_KEY, id);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketData {
  query: string;
  count: number;
  median: number;
  average: number;
  min: number;
  max: number;
  samples: { title: string; price: number; brand: string; photo: string }[];
  error?: string;
}

export interface VintedItem {
  id: string;
  title: string;
  price: number;
  brand: string;
  category: string;
  photoUrl: string;
  status: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchMarketPrice(
  brand: string,
  category: string
): Promise<MarketData> {
  const base = await getBackendUrl();
  const params = new URLSearchParams({ brand, category });
  const res = await fetch(`${base}/api/vinted/market-price?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<MarketData>;
}

export async function fetchUserItems(userId: string): Promise<VintedItem[]> {
  const base = await getBackendUrl();
  const res = await fetch(`${base}/api/vinted/user-items/${userId}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<VintedItem[]>;
}

export async function pingBackend(): Promise<boolean> {
  try {
    const base = await getBackendUrl();
    const res = await fetch(`${base}/api/vinted/ping`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json() as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract numeric Vinted user ID from a URL or raw input.
 *  Accepts: "12345", "12345-username", "vinted.fr/member/12345-username" */
export function extractUserId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/(\d+)(?:-[^/?#\s]*)?(?:[/?#].*)?$/);
  if (match) return match[1];
  return trimmed;
}
