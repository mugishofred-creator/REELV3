import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { StockItem, Vente, Retour } from "../store/context";

function escape(v: unknown): string {
  const s = String(v ?? "");
  if (/[";,\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(headers: string[], rows: (string | number | boolean)[][]): string {
  const lines = [headers.join(",")];
  rows.forEach((r) => lines.push(r.map(escape).join(",")));
  return lines.join("\n");
}

export function buildStockCSV(stock: StockItem[]): string {
  return toCSV(
    [
      "id",
      "nom",
      "marque",
      "categorie",
      "prix_achat",
      "prix_vente",
      "vues",
      "favoris",
      "jours",
      "defaut",
      "saison",
      "reposts",
      "date_creation",
    ],
    stock.map((s) => [
      s.id,
      s.name,
      s.brand,
      s.category,
      s.buyPrice,
      s.sellPrice,
      s.views,
      s.favorites,
      s.daysOnline,
      s.defect ? "oui" : "non",
      s.season,
      s.repostCount,
      s.createdAt,
    ])
  );
}

export function buildVentesCSV(ventes: Vente[]): string {
  return toCSV(
    ["id", "nom", "marque", "prix_achat", "prix_vente", "profit", "delai", "date"],
    ventes.map((v) => [
      v.id,
      v.name,
      v.brand,
      v.buyPrice,
      v.sellPrice,
      v.sellPrice - v.buyPrice,
      v.delay,
      v.date,
    ])
  );
}

export function buildRetoursCSV(retours: Retour[]): string {
  return toCSV(
    ["id", "produit", "marque", "raison", "remboursement", "date"],
    retours.map((r) => [r.id, r.product, r.brand, r.reason, r.refund, r.date])
  );
}

async function shareCSV(name: string, csv: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
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
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "text/csv",
      dialogTitle: name,
    });
  } else {
    Alert.alert("Fichier exporté", uri);
  }
}

export async function exportStock(stock: StockItem[]) {
  if (stock.length === 0) return Alert.alert("Vide", "Aucun article à exporter.");
  await shareCSV(`vinted-stock-${Date.now()}.csv`, buildStockCSV(stock));
}

export async function exportVentes(ventes: Vente[]) {
  if (ventes.length === 0) return Alert.alert("Vide", "Aucune vente à exporter.");
  await shareCSV(`vinted-ventes-${Date.now()}.csv`, buildVentesCSV(ventes));
}

export async function exportRetours(retours: Retour[]) {
  if (retours.length === 0) return Alert.alert("Vide", "Aucun retour à exporter.");
  await shareCSV(`vinted-retours-${Date.now()}.csv`, buildRetoursCSV(retours));
}
