import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../store/storage";

const BACKUP_VERSION = 1;
const APP_TAG = "vinted-manager";

export interface BackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  stock: unknown[];
  ventes: unknown[];
  clients: unknown[];
  retours: unknown[];
  niches: unknown[];
}

export async function buildBackup(): Promise<BackupPayload> {
  const [stock, ventes, clients, retours, niches] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.stock),
    AsyncStorage.getItem(STORAGE_KEYS.ventes),
    AsyncStorage.getItem(STORAGE_KEYS.clients),
    AsyncStorage.getItem(STORAGE_KEYS.retours),
    AsyncStorage.getItem(STORAGE_KEYS.niches),
  ]);
  return {
    version: BACKUP_VERSION,
    app: APP_TAG,
    exportedAt: new Date().toISOString(),
    stock: stock ? JSON.parse(stock) : [],
    ventes: ventes ? JSON.parse(ventes) : [],
    clients: clients ? JSON.parse(clients) : [],
    retours: retours ? JSON.parse(retours) : [],
    niches: niches ? JSON.parse(niches) : [],
  };
}

export async function exportBackup(): Promise<void> {
  const payload = await buildBackup();
  const json = JSON.stringify(payload, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const name = `vinted-manager-backup-${date}.json`;

  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) {
    Alert.alert("Erreur", "Stockage indisponible.");
    return;
  }
  const uri = dir + name;
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Sauvegarder Vinted Manager",
    });
  } else {
    Alert.alert("Sauvegarde créée", uri);
  }
}

function isValidPayload(o: unknown): o is BackupPayload {
  if (!o || typeof o !== "object") return false;
  const p = o as Record<string, unknown>;
  return (
    p.app === APP_TAG &&
    typeof p.version === "number" &&
    Array.isArray(p.stock) &&
    Array.isArray(p.ventes) &&
    Array.isArray(p.clients) &&
    Array.isArray(p.retours) &&
    Array.isArray(p.niches)
  );
}

export type RestoreMode = "replace" | "merge";

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  current.forEach((x) => map.set(x.id, x));
  incoming.forEach((x) => map.set(x.id, x));
  return Array.from(map.values());
}

async function readTextFromUri(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    return await res.text();
  }
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export interface RestoreResult {
  ok: boolean;
  payload?: BackupPayload;
  reason?: string;
}

export async function pickBackupFile(): Promise<RestoreResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) {
    return { ok: false, reason: "cancelled" };
  }
  try {
    const text = await readTextFromUri(res.assets[0].uri);
    const parsed = JSON.parse(text);
    if (!isValidPayload(parsed)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, reason: "parse" };
  }
}

export async function applyRestore(
  payload: BackupPayload,
  mode: RestoreMode
): Promise<void> {
  if (mode === "replace") {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.stock, JSON.stringify(payload.stock)),
      AsyncStorage.setItem(STORAGE_KEYS.ventes, JSON.stringify(payload.ventes)),
      AsyncStorage.setItem(
        STORAGE_KEYS.clients,
        JSON.stringify(payload.clients)
      ),
      AsyncStorage.setItem(
        STORAGE_KEYS.retours,
        JSON.stringify(payload.retours)
      ),
      AsyncStorage.setItem(STORAGE_KEYS.niches, JSON.stringify(payload.niches)),
    ]);
    return;
  }
  // merge
  const keys: {
    key: string;
    incoming: { id: string }[];
  }[] = [
    { key: STORAGE_KEYS.stock, incoming: payload.stock as { id: string }[] },
    { key: STORAGE_KEYS.ventes, incoming: payload.ventes as { id: string }[] },
    { key: STORAGE_KEYS.clients, incoming: payload.clients as { id: string }[] },
    { key: STORAGE_KEYS.retours, incoming: payload.retours as { id: string }[] },
    { key: STORAGE_KEYS.niches, incoming: payload.niches as { id: string }[] },
  ];
  for (const { key, incoming } of keys) {
    const raw = await AsyncStorage.getItem(key);
    const current = raw ? JSON.parse(raw) : [];
    const merged = mergeById(current, incoming);
    await AsyncStorage.setItem(key, JSON.stringify(merged));
  }
}

export function countPayload(p: BackupPayload): string {
  return `${p.stock.length} articles • ${p.ventes.length} ventes • ${p.clients.length} clients • ${p.retours.length} retours • ${p.niches.length} niches`;
}
