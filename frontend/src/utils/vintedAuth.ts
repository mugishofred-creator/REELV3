import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "vm:vintedToken";
const COOKIE_KEY = "vm:vintedCookie";
const LOGIN_KEY = "vm:vintedLogin";

export async function getVintedToken(): Promise<string | null> {
  try { return await AsyncStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export async function getVintedCookie(): Promise<string | null> {
  try { return await AsyncStorage.getItem(COOKIE_KEY); } catch { return null; }
}

export async function getSavedLogin(): Promise<string> {
  try { return (await AsyncStorage.getItem(LOGIN_KEY)) || ""; } catch { return ""; }
}

export async function saveVintedSession(data: {
  token?: string;
  cookie?: string;
  login?: string;
}): Promise<void> {
  const ops: [string, string][] = [];
  if (data.token) ops.push([TOKEN_KEY, data.token]);
  if (data.cookie) ops.push([COOKIE_KEY, data.cookie]);
  if (data.login) ops.push([LOGIN_KEY, data.login]);
  if (ops.length) await AsyncStorage.multiSet(ops);
}

export async function clearVintedAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, COOKIE_KEY, LOGIN_KEY]);
}

export async function isAuthenticated(): Promise<boolean> {
  const [token, cookie] = await Promise.all([getVintedToken(), getVintedCookie()]);
  return !!(token || cookie);
}

const UA = "com.vinted.android/24.6.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014)";

const BROWSER_UA = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const [token, cookie] = await Promise.all([getVintedToken(), getVintedCookie()]);

  // Bearer token (OAuth mobile) → headers Android app
  if (token && token !== "session") {
    return {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      "Authorization": `Bearer ${token}`,
    };
  }

  // Cookie web session → headers navigateur (cohérent avec la session)
  if (cookie) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      "Cookie": cookie,
      "Origin": "https://www.vinted.fr",
      "Referer": "https://www.vinted.fr/",
    };
  }

  // Pas d'auth
  return {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  };
}
