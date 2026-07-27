import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  cacheDirectory,
  writeAsStringAsync,
  readAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { getAllEntries, importEntries, reloadStore } from './store';
import { DayEntry, BackupFile } from './types';

export async function exportToFile(): Promise<void> {
  const entries = await getAllEntries();
  const backup: BackupFile = {
    appVersion: '1.0.0',
    exportedAt: Date.now(),
    entries,
  };
  const json = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const path = (cacheDirectory ?? '') + `codex-backup-${date}.json`;
  await writeAsStringAsync(path, json, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Exporter le codex' });
}

export async function importFromFile(mode: 'merge' | 'replace'): Promise<{ count: number }> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (result.canceled || !result.assets?.[0]) throw new Error('Annulé');

  const uri = result.assets[0].uri;
  const raw = await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
  const backup = JSON.parse(raw) as BackupFile;

  if (!backup.entries || typeof backup.entries !== 'object') {
    throw new Error('Fichier invalide');
  }

  await importEntries(backup.entries as Record<string, DayEntry>, mode);
  await reloadStore();
  return { count: Object.keys(backup.entries).length };
}
