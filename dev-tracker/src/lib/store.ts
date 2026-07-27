import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayEntry, StoredData } from './types';
import { scoreDay } from './scoring';

const STORAGE_KEY = '@codex:data';
const VERSION = 1;

let cache: StoredData | null = null;

async function loadData(): Promise<StoredData> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as StoredData;
    } else {
      cache = { entries: {}, version: VERSION };
    }
  } catch {
    cache = { entries: {}, version: VERSION };
  }
  return cache;
}

async function saveData(data: StoredData): Promise<void> {
  cache = data;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function reloadStore(): Promise<void> {
  cache = null;
  await loadData();
}

export async function getEntry(date: string): Promise<DayEntry | null> {
  const data = await loadData();
  return data.entries[date] ?? null;
}

export async function getAllEntries(): Promise<Record<string, DayEntry>> {
  const data = await loadData();
  return { ...data.entries };
}

export async function saveEntry(entry: DayEntry): Promise<void> {
  const data = await loadData();
  entry.updatedAt = Date.now();
  data.entries[entry.date] = entry;
  await saveData(data);
}

export async function deleteEntry(date: string): Promise<void> {
  const data = await loadData();
  delete data.entries[date];
  await saveData(data);
}

export function emptyEntry(date: string): DayEntry {
  return {
    date,
    cible: '',
    activiteDominante: '',
    voies: [],
    antidote: '',
    rites: [],
    energie: -1,
    limitations: [],
    derives: [],
    champInfluence: '',
    spectres: [],
    integrityKept: false,
    verbe: '',
    updatedAt: Date.now(),
  };
}

export async function importEntries(
  incoming: Record<string, DayEntry>,
  mode: 'merge' | 'replace'
): Promise<void> {
  if (mode === 'replace') {
    const newData: StoredData = { entries: incoming, version: VERSION };
    await saveData(newData);
    return;
  }
  const data = await loadData();
  for (const [date, entry] of Object.entries(incoming)) {
    const existing = data.entries[date];
    if (!existing || (entry.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      data.entries[date] = entry;
    }
  }
  await saveData(data);
}
