import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "vm:vintedToken";
const LOGIN_KEY = "vm:vintedLogin";

const VINTED_BASE = "https://www.vinted.fr/api/v2";
const UA = "com.vinted.android/24.6.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014)";

export type VintedAuthState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; token: string; login: string };

export async function getVintedToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getSavedLogin(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(LOGIN_KEY)) || "";
  } catch {
    return "";
  }
}

export async function clearVintedAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, LOGIN_KEY]);
}

export async function vintedLogin(
  login: string,
  password: string
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${VINTED_BASE}/users/login`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      body: JSON.stringify({ user: { login, password } }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const msg = (data.error as string) || (data.message as string) || `Erreur ${res.status}`;
      return { success: false, error: msg };
    }

    const token =
      (data.access_token as string) ||
      ((data.user as Record<string, unknown>)?.access_token as string) ||
      "";

    if (!token) {
      return { success: false, error: "Token non reçu. Vérifie tes identifiants." };
    }

    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(LOGIN_KEY, login);
    return { success: true, token };
  } catch (e: unknown) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : "Erreur réseau";
    return { success: false, error: msg };
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getVintedToken();
  const base: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "X-Device-Id": "android",
  };
  if (token) base["Authorization"] = `Bearer ${token}`;
  return base;
}
