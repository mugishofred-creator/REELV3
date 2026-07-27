import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  profile: "jp:profile",
  ai: "jp:ai",
  cvs: "jp:cvs",
  letters: "jp:letters",
  filters: "jp:filters",
  applications: "jp:applications",
  campaign: "jp:campaign",
};

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
