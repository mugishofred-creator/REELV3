import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../store/storage";
import type { StockItem, Vente } from "../store/context";
import { detectSeason } from "./logic";

export interface ImportReport {
  stockAdded: number;
  ventesAdded: number;
  ignored: number;
  total: number;
  error?: string;
}

function rid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === "\n" && !inQuotes) {
      lines.push(cur);
      cur = "";
    } else if (c === "\r" && !inQuotes) {
      // skip
    } else {
      cur += c;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let f = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          f += '"';
          i++;
        } else q = !q;
      } else if ((c === "," || c === ";") && !q) {
        out.push(f);
        f = "";
      } else {
        f += c;
      }
    }
    out.push(f);
    return out;
  };

  const headers = parseLine(lines[0]).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[éè]/g, "e")
  );
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function toNumber(v: string): number | null {
  if (!v) return null;
  const s = v.replace(",", ".").replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string): Date | null {
  if (!v) return null;
  // Try ISO, dd/mm/yyyy, yyyy-mm-dd
  const iso = new Date(v);
  if (!isNaN(iso.getTime())) return iso;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export async function importCsvBackup(): Promise<ImportReport> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) {
    return { stockAdded: 0, ventesAdded: 0, ignored: 0, total: 0, error: "cancelled" };
  }
  try {
    let text: string;
    if (Platform.OS === "web") {
      const r = await fetch(res.assets[0].uri);
      text = await r.text();
    } else {
      text = await FileSystem.readAsStringAsync(res.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
    const rows = parseCSV(text);
    if (!rows.length) {
      return { stockAdded: 0, ventesAdded: 0, ignored: 0, total: 0, error: "empty" };
    }

    const existingStock: StockItem[] = JSON.parse(
      (await AsyncStorage.getItem(STORAGE_KEYS.stock)) || "[]"
    );
    const existingVentes: Vente[] = JSON.parse(
      (await AsyncStorage.getItem(STORAGE_KEYS.ventes)) || "[]"
    );

    const newStock: StockItem[] = [];
    const newVentes: Vente[] = [];
    let ignored = 0;

    const now = new Date();

    for (const row of rows) {
      try {
        const brand = (row.marque || row.brand || "").trim();
        const name = (row.nom || row.name || `${brand || "Article"}`).trim();
        const category = (row.categorie || row.category || "").trim();
        const buyPrice = toNumber(row.prix_achat || row.buy || row.buy_price || "");
        const sellPrice = toNumber(row.prix_vente || row.sell || row.sell_price || "");
        const fees = toNumber(row.frais || row.fees || "") ?? 0;
        const views = toNumber(row.vues || row.views || "") ?? 0;
        const favorites = toNumber(row.favoris || row.favorites || "") ?? 0;
        const datePubStr = row.date_publication || row.date_pub || row.publication || "";
        const dateSaleStr = row.date_vente || row.sale_date || row.date_sale || "";
        const datePub = toDate(datePubStr);
        const dateSale = toDate(dateSaleStr);

        if (!brand && !name) {
          ignored++;
          continue;
        }

        if (dateSale) {
          // Vente historique
          if (sellPrice === null) {
            ignored++;
            continue;
          }
          const delayDays = datePub
            ? Math.max(
                0,
                Math.round(
                  (dateSale.getTime() - datePub.getTime()) / (3600000 * 24)
                )
              )
            : 0;
          newVentes.push({
            id: rid(),
            name,
            brand: brand || "inconnu",
            buyPrice: buyPrice ?? 0,
            sellPrice,
            delay: delayDays,
            date: dateSale.toISOString(),
            fees,
          });
        } else {
          // Stock actif
          const publication = datePub ?? now;
          const daysOnline = Math.max(
            0,
            Math.round((now.getTime() - publication.getTime()) / (3600000 * 24))
          );
          newStock.push({
            id: rid(),
            name,
            brand: brand || "inconnu",
            category: category || "",
            buyPrice: buyPrice ?? 0,
            sellPrice: sellPrice ?? 0,
            views,
            favorites,
            daysOnline,
            defect: false,
            season: detectSeason(category) as StockItem["season"],
            repostCount: 0,
            sold: false,
            createdAt: now.toISOString(),
            datePublication: publication.toISOString(),
            fees,
          });
        }
      } catch {
        ignored++;
      }
    }

    // Dédupe grossier sur stock: même nom+marque+prix_achat
    const sig = (s: StockItem) =>
      `${s.name}|${s.brand}|${s.buyPrice}|${s.datePublication ?? s.createdAt}`;
    const existingSigs = new Set(existingStock.map(sig));
    const filteredStock = newStock.filter((s) => !existingSigs.has(sig(s)));
    const stockDupes = newStock.length - filteredStock.length;

    const vsig = (v: Vente) =>
      `${v.name}|${v.brand}|${v.sellPrice}|${v.date}`;
    const existingVSigs = new Set(existingVentes.map(vsig));
    const filteredVentes = newVentes.filter((v) => !existingVSigs.has(vsig(v)));
    const venteDupes = newVentes.length - filteredVentes.length;

    await AsyncStorage.setItem(
      STORAGE_KEYS.stock,
      JSON.stringify([...filteredStock, ...existingStock])
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.ventes,
      JSON.stringify([...filteredVentes, ...existingVentes])
    );

    return {
      stockAdded: filteredStock.length,
      ventesAdded: filteredVentes.length,
      ignored: ignored + stockDupes + venteDupes,
      total: rows.length,
    };
  } catch (e) {
    return {
      stockAdded: 0,
      ventesAdded: 0,
      ignored: 0,
      total: 0,
      error: "parse",
    };
  }
}

export function sampleCsvTemplate(): string {
  return [
    "nom,marque,categorie,date_achat,date_publication,date_vente,prix_achat,prix_vente,frais,vues,favoris",
    "Pantalon cargo,Carhartt,cargo,2026-01-10,2026-01-12,2026-01-18,13,38,5,120,18",
    'Jean 501,Levi\'s,jean,,2026-02-05,,20,45,6,45,4',
  ].join("\n");
}
