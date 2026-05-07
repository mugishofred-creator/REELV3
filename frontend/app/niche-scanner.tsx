import React, { useState, useRef } from "react";
import {
  ScrollView, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Image, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card } from "../src/components/Card";
import { colors, shadow } from "../src/theme/colors";
import { getAuthHeaders } from "../src/utils/vintedAuth";

// ── Types ──────────────────────────────────────────────────────────────────────

type Deal = {
  id: string;
  title: string;
  price: number;
  brand: string;
  photo: string;
  marketEstimate: number;
  discountPct: number;
  vintedUrl: string;
};

// ── Vinted search ──────────────────────────────────────────────────────────────

const VINTED_BASE = "https://www.vinted.fr/api/v2";

function parsePrice(raw: unknown): number {
  if (raw && typeof raw === "object" && "amount" in raw)
    return parseFloat((raw as { amount: string }).amount) || 0;
  return parseFloat(String(raw ?? 0)) || 0;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function searchVinted(query: string, maxPrice?: number, page = 1): Promise<unknown[]> {
  let qs = `search_text=${encodeURIComponent(query)}&per_page=96&page=${page}&order=price_low_to_high`;
  if (maxPrice) qs += `&price_to=${maxPrice}`;
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${VINTED_BASE}/catalog/items?${qs}`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data as { items?: unknown[] }).items ?? [];
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NicheScannerScreen() {
  const [keywords, setKeywords] = useState("");
  const [minDiscount, setMinDiscount] = useState("30");
  const [scanning, setScanning] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [scanned, setScanned] = useState(0);
  const [marketMedian, setMarketMedian] = useState(0);
  const abortRef = useRef(false);

  const handleScan = async () => {
    const q = keywords.trim();
    if (!q) return;

    setScanning(true);
    setDeals([]);
    setScanned(0);
    abortRef.current = false;

    try {
      // 1. Get market median (relevance order, full catalog)
      const marketItems = await searchVinted(q) as Record<string, unknown>[];
      const allPrices = marketItems.map((i) => parsePrice(i.price)).filter((p) => p > 0);
      const med = median(allPrices);
      setMarketMedian(med);

      if (med === 0) return;

      // 2. Scan cheapest listings (price low to high)
      const threshold = med * (1 - (Number(minDiscount) || 30) / 100);
      const cheapItems = await searchVinted(q, Math.ceil(threshold)) as Record<string, unknown>[];
      setScanned(cheapItems.length);

      const foundDeals: Deal[] = [];
      for (const item of cheapItems) {
        if (abortRef.current) break;
        const price = parsePrice(item.price);
        if (price <= 0 || price >= med) continue;
        const discountPct = Math.round(((med - price) / med) * 100);
        if (discountPct < (Number(minDiscount) || 30)) continue;

        const photos = (item.photos as { url?: string; full_size_url?: string }[] | undefined) ?? [];
        foundDeals.push({
          id: String(item.id ?? ""),
          title: String(item.title ?? ""),
          price,
          brand: String(item.brand_title ?? ""),
          photo: photos[0]?.url ?? photos[0]?.full_size_url ?? "",
          marketEstimate: med,
          discountPct,
          vintedUrl: `https://www.vinted.fr/items/${item.id}`,
        });
      }

      // Sort by best discount first
      foundDeals.sort((a, b) => b.discountPct - a.discountPct);
      setDeals(foundDeals);
    } catch {
      // silent
    } finally {
      setScanning(false);
    }
  };

  const handleStop = () => { abortRef.current = true; };

  return (
    <ModalScreen title="Scanner de niches" subtitle="Trouve les sous-cotés pour revendre">
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Paramètres ── */}
        <Card style={styles.paramCard}>
          <Text style={styles.paramTitle}>Paramètres du scan</Text>

          <Text style={styles.label}>Mots-clés</Text>
          <TextInput
            style={styles.input}
            value={keywords}
            onChangeText={setKeywords}
            placeholder="ex: carhartt veste, nike air max..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Décote minimum vs marché (%)</Text>
          <View style={styles.discountRow}>
            {["20", "30", "40", "50"].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.discountBtn, minDiscount === d && styles.discountBtnActive]}
                onPress={() => setMinDiscount(d)}
              >
                <Text style={[styles.discountText, minDiscount === d && styles.discountTextActive]}>
                  -{d}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {scanning ? (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <ActivityIndicator size="small" color={colors.urgent} />
              <Text style={styles.stopBtnText}>Arrêter le scan</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.scanBtn, !keywords.trim() && styles.scanBtnDisabled]}
              onPress={handleScan}
              disabled={!keywords.trim()}
            >
              <Ionicons name="search" size={16} color="#000" />
              <Text style={styles.scanBtnText}>Scanner Vinted</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* ── Résultats ── */}
        {marketMedian > 0 && (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{marketMedian.toFixed(0)} €</Text>
                <Text style={styles.summaryLabel}>Prix médian marché</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.good }]}>{deals.length}</Text>
                <Text style={styles.summaryLabel}>deals trouvés</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{scanned}</Text>
                <Text style={styles.summaryLabel}>articles scannés</Text>
              </View>
            </View>
          </Card>
        )}

        {deals.length === 0 && !scanning && marketMedian > 0 && (
          <Card>
            <Text style={styles.empty}>Aucun deal trouvé avec -{minDiscount}% de décote.</Text>
            <Text style={styles.emptyHint}>Essaie de baisser la décote minimum ou change les mots-clés.</Text>
          </Card>
        )}

        {deals.map((deal) => (
          <TouchableOpacity
            key={deal.id}
            onPress={() => Linking.openURL(deal.vintedUrl).catch(() => null)}
            activeOpacity={0.75}
          >
            <Card style={styles.dealCard} accent="good">
              <View style={styles.dealRow}>
                {deal.photo ? (
                  <Image source={{ uri: deal.photo }} style={styles.dealPhoto} />
                ) : (
                  <View style={[styles.dealPhoto, styles.dealPhotoEmpty]}>
                    <Ionicons name="shirt-outline" size={20} color={colors.textMuted} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.dealTitle} numberOfLines={2}>{deal.title}</Text>
                  {deal.brand ? <Text style={styles.dealBrand}>{deal.brand}</Text> : null}
                  <Text style={styles.dealMarket}>
                    Marché : ~{deal.marketEstimate.toFixed(0)} € · potentiel +{(deal.marketEstimate - deal.price).toFixed(0)} €
                  </Text>
                </View>

                <View style={styles.dealRight}>
                  <Text style={styles.dealPrice}>{deal.price.toFixed(0)} €</Text>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>-{deal.discountPct}%</Text>
                  </View>
                  <Text style={styles.openText}>OUVRIR →</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },

  paramCard: { marginBottom: 12 },
  paramTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", marginBottom: 14 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 14, marginBottom: 14,
  },
  discountRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  discountBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  discountBtnActive: { backgroundColor: colors.goodGlow, borderColor: colors.good },
  discountText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  discountTextActive: { color: colors.good },

  scanBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: colors.good, borderRadius: 12, paddingVertical: 13,
    ...shadow.glow,
  },
  scanBtnDisabled: { opacity: 0.4 },
  scanBtnText: { color: "#000", fontWeight: "900", fontSize: 15 },
  stopBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1, borderColor: colors.urgentBorder,
    backgroundColor: colors.urgentBg, borderRadius: 12, paddingVertical: 13,
  },
  stopBtnText: { color: colors.urgent, fontWeight: "900", fontSize: 14 },

  summaryCard: { marginBottom: 12 },
  summaryRow: { flexDirection: "row" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { color: colors.textPrimary, fontSize: 18, fontWeight: "900" },
  summaryLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2, textAlign: "center" },

  dealCard: { marginBottom: 10 },
  dealRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dealPhoto: { width: 64, height: 64, borderRadius: 10 },
  dealPhotoEmpty: { backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  dealTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", lineHeight: 18, marginBottom: 2 },
  dealBrand: { color: colors.textMuted, fontSize: 11, marginBottom: 4 },
  dealMarket: { color: colors.info, fontSize: 10, fontWeight: "700" },

  dealRight: { alignItems: "center", gap: 4 },
  dealPrice: { color: colors.good, fontSize: 18, fontWeight: "900" },
  discountBadge: { backgroundColor: colors.good, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  discountBadgeText: { color: "#000", fontSize: 11, fontWeight: "900" },
  openText: { color: colors.good, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  empty: { color: colors.textMuted, textAlign: "center", fontWeight: "700" },
  emptyHint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 18 },
});
