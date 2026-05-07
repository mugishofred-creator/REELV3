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

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const [token, cookie] = await Promise.all([getVintedToken(), getVintedCookie()]);
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  };
  if (token && token !== "session") {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  return headers;
}
