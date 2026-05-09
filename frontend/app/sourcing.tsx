import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  ScrollView, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card, SectionTitle } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { ProgressBar } from "../src/components/ProgressBar";
import { MiniBarChart } from "../src/components/MiniBarChart";
import { colors } from "../src/theme/colors";
import { useData } from "../src/store/context";
import { sourcingAnalyze, type Sourcing as SourcingVerdict } from "../src/utils/analytics";
import { computeNiches } from "../src/utils/logic";
import { fetchMarketPrice, type MarketData } from "../src/utils/vintedApi";
import {
  saveMarketSnapshot, getBrandTrend, detectPriceDrop,
  type MarketSnapshot, type PriceDropAlert,
} from "../src/utils/marketHistory";

function verdictTone(v: SourcingVerdict): "good" | "info" | "warning" | "urgent" | "neutral" {
  if (v === "ACHETER") return "good";
  if (v === "OK") return "info";
  if (v === "NEGOCIER") return "warning";
  if (v === "REFUSER") return "urgent";
  return "neutral";
}

function verdictIcon(v: SourcingVerdict): string {
  if (v === "ACHETER") return "🟢 ACHETER";
  if (v === "OK") return "🔵 OK";
  if (v === "NEGOCIER") return "🟡 NÉGOCIER";
  if (v === "REFUSER") return "🔴 REFUSER";
  return "⚪ DONNÉES INSUFFISANTES";
}

export default function Sourcing() {
  const { ventes } = useData();
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [targetProfit, setTargetProfit] = useState("15");

  // ── Live market state ──
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const lastFetchRef = useRef<string>("");

  // ── History + alert state ──
  const [trend, setTrend] = useState<MarketSnapshot[]>([]);
  const [dropAlert, setDropAlert] = useState<PriceDropAlert | null>(null);

  const buyNum = Number(buyPrice) || 0;
  const feesNum = Number(fees) || 0;
  const targetNum = Number(targetProfit) || 15;

  // Reset when brand/category changes
  useEffect(() => {
    setMarket(null);
    setTrend([]);
    setDropAlert(null);
    lastFetchRef.current = "";
  }, [brand, category]);

  // Load trend whenever brand+category are filled
  useEffect(() => {
    const b = brand.trim();
    const c = category.trim();
    if (b.length < 2) return;
    const timeout = new Promise<MarketSnapshot[]>((resolve) => setTimeout(() => resolve([]), 5000));
    Promise.race([getBrandTrend(b, c), timeout]).then(setTrend);
  }, [brand, category]);

  // ── Personal history ──
  const brandHistory = useMemo(() => {
    const bl = brand.trim().toLowerCase();
    if (!bl) return null;
    const sales = ventes.filter((v) => v.brand.toLowerCase() === bl);
    if (sales.length === 0) return null;
    const avgSell = sales.reduce((s, v) => s + v.sellPrice, 0) / sales.length;
    const avgDelay = sales.reduce((s, v) => s + (v.delay || 0), 0) / sales.length;
    const profits = sales.map((v) => v.sellPrice - v.buyPrice - (v.fees || 0) - (v.boostCost || 0));
    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const bestSale = profits.reduce(
      (best, p, i) => (p > best.profit ? { profit: p, sale: sales[i] } : best),
      { profit: -Infinity, sale: sales[0] }
    );
    const winRate = profits.filter((p) => p > 0).length / profits.length;
    return { count: sales.length, avgSell, avgDelay, avgProfit, bestSale, winRate };
  }, [brand, ventes]);

  // ── Reference price: live market > personal history ──
  const referencePrice = market && market.count > 0
    ? market.median
    : brandHistory?.avgSell ?? null;

  const referenceSource = market && market.count > 0
    ? `marché live (${market.count} annonces)`
    : brandHistory
    ? `historique perso (${brandHistory.count} ventes)`
    : null;

  // ── Max buy price ──
  const maxBuyPrice = useMemo(() => {
    if (referencePrice === null) return null;
    return Math.max(0, referencePrice - targetNum - feesNum);
  }, [referencePrice, targetNum, feesNum]);

  // ── Sourcing analysis ──
  const result = useMemo(() => {
    if (!brand.trim() || buyNum <= 0) return null;
    return sourcingAnalyze(brand.trim(), category.trim(), buyNum, ventes, feesNum);
  }, [brand, category, buyNum, ventes, feesNum]);

  // ── Top niches ──
  const topNiches = useMemo(() => computeNiches(ventes).slice(0, 5), [ventes]);

  const isGoodDeal = buyNum > 0 && maxBuyPrice !== null && buyNum <= maxBuyPrice;

  // ── Trend chart data ──
  const trendChart = useMemo(() =>
    trend.map((s, i) => ({
      label: new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).slice(0, 5),
      value: s.median,
      highlight: i === trend.length - 1,
    })), [trend]);

  // ── Live market fetch ──
  const handleFetchMarket = async () => {
    const b = brand.trim();
    const c = category.trim();
    const key = `${b}|${c}`;
    if (!b) return;
    if (lastFetchRef.current === key && market) return;

    setMarketLoading(true);
    setMarketError(null);
    try {
      const data = await fetchMarketPrice(b, c);
      if (data.count === 0) {
        setMarketError("Aucune annonce trouvée sur Vinted pour cette recherche.");
        setMarket(null);
        return;
      }
      setMarket(data);
      lastFetchRef.current = key;

      // Save to history
      await saveMarketSnapshot({ brand: b, category: c, query: data.query, median: data.median, average: data.average, count: data.count });

      // Reload trend + check drop
      const [newTrend, alert] = await Promise.all([
        getBrandTrend(b, c),
        detectPriceDrop(b, c, data.median),
      ]);
      setTrend(newTrend);
      setDropAlert(alert);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur réseau";
      setMarketError(
        msg.includes("502") || msg.includes("unreachable")
          ? "Backend inaccessible. Configure l'URL dans Plus > Paramètres."
          : msg
      );
      setMarket(null);
    } finally {
      setMarketLoading(false);
    }
  };

  const canFetchMarket = brand.trim().length >= 2;

  return (
    <ModalScreen title="Sourcing IA" subtitle="Analyse instantanée · prix max · verdict">
      <ScrollView contentContainerStyle={styles.content} testID="sourcing-scroll" keyboardShouldPersistTaps="handled">

        {/* ── FORMULAIRE ── */}
        <View style={styles.inputGroup}>
          <Label>Marque</Label>
          <StyledInput value={brand} onChangeText={setBrand} placeholder="Carhartt, Levi's, Nike…" testID="sourcing-brand" />
        </View>
        <View style={styles.inputGroup}>
          <Label>Catégorie</Label>
          <StyledInput value={category} onChangeText={setCategory} placeholder="cargo, workwear, jean…" testID="sourcing-category" />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Label>Prix achat (€)</Label>
            <StyledInput value={buyPrice} onChangeText={setBuyPrice} placeholder="0" keyboardType="numeric" testID="sourcing-price" />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Frais (€)</Label>
            <StyledInput value={fees} onChangeText={setFees} placeholder="0" keyboardType="numeric" testID="sourcing-fees" />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Profit cible (€)</Label>
            <StyledInput value={targetProfit} onChangeText={setTargetProfit} placeholder="15" keyboardType="numeric" testID="sourcing-target" />
          </View>
        </View>

        {/* ── BOUTON MARCHÉ LIVE ── */}
        {canFetchMarket && (
          <TouchableOpacity
            onPress={handleFetchMarket}
            style={[styles.marketBtn, marketLoading && styles.marketBtnLoading]}
            disabled={marketLoading}
            testID="sourcing-market-btn"
            activeOpacity={0.8}
          >
            {marketLoading
              ? <ActivityIndicator size="small" color={colors.bg} />
              : <Ionicons name="trending-up-outline" size={16} color={colors.bg} />
            }
            <Text style={styles.marketBtnText}>
              {marketLoading ? "Recherche en cours…" : market ? "Actualiser le prix marché" : "Récupérer les prix du marché Vinted"}
            </Text>
          </TouchableOpacity>
        )}

        {marketError && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={14} color={colors.warning} />
            <Text style={styles.errorText}>{marketError}</Text>
          </View>
        )}

        {/* ── ALERTE BAISSE DE PRIX ── */}
        {dropAlert && (
          <View style={styles.dropAlert} testID="sourcing-drop-alert">
            <Ionicons name="trending-down-outline" size={16} color={colors.urgent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dropAlertTitle}>
                ⚠ Prix en baisse de {dropAlert.dropPct}% en {dropAlert.daysAgo}j
              </Text>
              <Text style={styles.dropAlertSub}>
                {dropAlert.previous.toFixed(0)}€ → {dropAlert.current.toFixed(0)}€ médiane (−{dropAlert.drop.toFixed(0)}€)
              </Text>
            </View>
          </View>
        )}

        {/* ── DONNÉES MARCHÉ LIVE ── */}
        {market && market.count > 0 && (
          <>
            <SectionTitle title="Prix du marché Vinted" subtitle={`"${market.query}" · ${market.count} annonces actives`} />
            <Card style={styles.marketCard} testID="sourcing-market-card">
              <View style={styles.histRow}>
                <HistStat label="Médiane" value={`${market.median.toFixed(0)} €`} color={colors.good} />
                <HistStat label="Moyenne" value={`${market.average.toFixed(0)} €`} color={colors.info} />
                <HistStat label="Min" value={`${market.min.toFixed(0)} €`} color={colors.textMuted} />
                <HistStat label="Max" value={`${market.max.toFixed(0)} €`} color={colors.textMuted} />
              </View>
              {market.samples.length > 0 && (
                <View style={styles.samplesList}>
                  {market.samples.slice(0, 5).map((s, i) => (
                    <View key={i} style={[styles.sampleRow, i < 4 && styles.sampleBorder]}>
                      <Text style={styles.sampleTitle} numberOfLines={1}>{s.title || s.brand}</Text>
                      <Text style={[styles.samplePrice, { color: colors.good }]}>{s.price.toFixed(0)} €</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.marketSourceBadge}>
                <Ionicons name="checkmark-circle-outline" size={12} color={colors.good} />
                <Text style={styles.marketSourceText}>Données live Vinted · Android direct</Text>
              </View>
            </Card>
          </>
        )}

        {/* ── TENDANCE HISTORIQUE ── */}
        {trend.length >= 2 && (
          <>
            <SectionTitle
              title={`Tendance ${brand.trim().toUpperCase()}`}
              subtitle={`${trend.length} mesures enregistrées`}
            />
            <Card style={styles.trendCard} testID="sourcing-trend">
              <MiniBarChart data={trendChart} color={colors.info} height={48} />
              <View style={styles.trendStats}>
                <View>
                  <Text style={styles.trendLabel}>1ère mesure</Text>
                  <Text style={styles.trendValue}>{trend[0].median.toFixed(0)} €</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  {(() => {
                    const diff = trend[trend.length - 1].median - trend[0].median;
                    const pct = Math.round((diff / trend[0].median) * 100);
                    const up = diff >= 0;
                    return (
                      <>
                        <Text style={[styles.trendDiff, { color: up ? colors.good : colors.urgent }]}>
                          {up ? "+" : ""}{diff.toFixed(0)}€
                        </Text>
                        <Text style={[styles.trendPct, { color: up ? colors.good : colors.urgent }]}>
                          {up ? "▲" : "▼"} {Math.abs(pct)}%
                        </Text>
                      </>
                    );
                  })()}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.trendLabel}>Dernière mesure</Text>
                  <Text style={styles.trendValue}>{trend[trend.length - 1].median.toFixed(0)} €</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* ── HISTORIQUE PERSONNEL ── */}
        {brandHistory && (
          <>
            <SectionTitle
              title={`Historique ${brand.trim().toUpperCase()}`}
              subtitle={`${brandHistory.count} vente${brandHistory.count > 1 ? "s" : ""} dans ta base`}
            />
            <Card style={styles.historyCard}>
              <View style={styles.histRow}>
                <HistStat label="Prix moy. vente" value={`${brandHistory.avgSell.toFixed(0)} €`} color={colors.good} />
                <HistStat label="Profit moy." value={`${brandHistory.avgProfit >= 0 ? "+" : ""}${brandHistory.avgProfit.toFixed(0)} €`} color={brandHistory.avgProfit >= 0 ? colors.good : colors.urgent} />
                <HistStat label="Délai moy." value={`${brandHistory.avgDelay.toFixed(0)}j`} color={brandHistory.avgDelay <= 7 ? colors.good : colors.warning} />
                <HistStat label="Taux win" value={`${Math.round(brandHistory.winRate * 100)}%`} color={brandHistory.winRate >= 0.7 ? colors.good : colors.warning} />
              </View>
              <ProgressBar
                progress={brandHistory.winRate}
                color={brandHistory.winRate >= 0.7 ? colors.good : colors.warning}
                label="Taux de succès"
                valueLabel={`${Math.round(brandHistory.winRate * 100)}%`}
                height={5}
              />
              {brandHistory.bestSale.sale && (
                <View style={styles.bestSaleRow}>
                  <Text style={styles.bestSaleLabel}>Meilleure vente : </Text>
                  <Text style={[styles.bestSaleValue, { color: colors.good }]}>
                    +{brandHistory.bestSale.profit.toFixed(0)}€ · {brandHistory.bestSale.sale.name}
                  </Text>
                </View>
              )}
            </Card>
          </>
        )}

        {/* ── PRIX MAX ACHAT ── */}
        {maxBuyPrice !== null && referenceSource && (
          <>
            <SectionTitle title="Calculateur de prix max" subtitle={`Pour atteindre ${targetNum}€ de profit`} />
            <Card style={[styles.maxPriceCard, { borderColor: isGoodDeal ? colors.goodBorder : buyNum > 0 ? colors.urgentBorder : colors.borderSoft }]}>
              <View style={styles.maxPriceRow}>
                <View>
                  <Text style={styles.maxPriceLabel}>PRIX MAX D'ACHAT</Text>
                  <Text style={[styles.maxPriceBig, { color: isGoodDeal || buyNum === 0 ? colors.good : colors.urgent }]}>
                    {maxBuyPrice.toFixed(0)} €
                  </Text>
                </View>
                {buyNum > 0 && (
                  <View style={styles.maxPriceVerdict}>
                    {isGoodDeal ? (
                      <>
                        <Text style={[styles.verdictBig, { color: colors.good }]}>✓ BON DEAL</Text>
                        <Text style={styles.verdictSub}>Tu es sous le seuil cible</Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.verdictBig, { color: colors.urgent }]}>✕ TROP CHER</Text>
                        <Text style={styles.verdictSub}>Dépasse de {(buyNum - maxBuyPrice).toFixed(0)}€</Text>
                      </>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.calcBreakdown}>
                <CalcRow label={`Prix réf. (${referenceSource})`} value={`${referencePrice!.toFixed(0)} €`} />
                <CalcRow label="Profit cible" value={`− ${targetNum} €`} />
                <CalcRow label="Frais" value={`− ${feesNum} €`} />
                <View style={styles.calcTotal}>
                  <Text style={styles.calcTotalLabel}>= Prix max achat</Text>
                  <Text style={[styles.calcTotalValue, { color: colors.good }]}>{maxBuyPrice.toFixed(0)} €</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* ── VERDICT SOURCING ── */}
        {result && (
          <>
            <SectionTitle title="Analyse complète" subtitle="Score · marge · catégorie" />
            <Card style={styles.resultCard} testID="sourcing-result">
              <View style={styles.verdictRow}>
                <Badge label={verdictIcon(result.verdict)} tone={verdictTone(result.verdict)} />
                <Text style={[styles.verdictReason, { color: verdictTone(result.verdict) === "good" ? colors.good : verdictTone(result.verdict) === "urgent" ? colors.urgent : colors.warning }]}>
                  {result.reason}
                </Text>
              </View>
              <ProgressBar
                progress={result.score / 100}
                color={result.score >= 70 ? colors.good : result.score >= 40 ? colors.warning : colors.urgent}
                label="Score sourcing"
                valueLabel={`${result.score} / 100`}
                height={7}
              />
              <View style={styles.statsGrid}>
                <StatBox label="Échantillon" value={`${result.sampleSize} vente${result.sampleSize > 1 ? "s" : ""}`} tone={result.sampleSize >= 3 ? "good" : result.sampleSize >= 1 ? "warning" : "urgent"} />
                <StatBox label="Prix moy. perso" value={result.avgSell > 0 ? `${result.avgSell.toFixed(0)} €` : "—"} />
                <StatBox
                  label="Profit estimé"
                  value={result.profit !== null ? `${result.profit >= 0 ? "+" : ""}${result.profit.toFixed(0)} €` : "—"}
                  tone={result.profit === null ? "neutral" : result.profit > 10 ? "good" : result.profit >= 0 ? "warning" : "urgent"}
                />
                <StatBox
                  label="Catégorie"
                  value={result.categoryBonus > 30 ? "🔥 Forte" : result.categoryBonus < 0 ? "❌ Faible" : "➖ Neutre"}
                  tone={result.categoryBonus > 30 ? "good" : result.categoryBonus < 0 ? "urgent" : "neutral"}
                />
              </View>
            </Card>
          </>
        )}

        {/* ── TOP NICHES ── */}
        {topNiches.length > 0 && (
          <>
            <SectionTitle title="Tes meilleures niches" subtitle="Basé sur ton historique de ventes" />
            <Card>
              {topNiches.map((n, i) => (
                <View key={n.brand} style={[styles.nicheRow, i < topNiches.length - 1 && styles.nicheBorder]}>
                  <Text style={[styles.nicheRank, { color: i === 0 ? colors.good : colors.textMuted }]}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nicheName}>{n.brand.toUpperCase()}</Text>
                    <Text style={styles.nicheMeta}>{n.count} ventes · {n.avgDelay}j moy.</Text>
                  </View>
                  <Text style={[styles.nicheProfit, { color: n.avgProfit >= 0 ? colors.good : colors.urgent }]}>
                    {n.avgProfit >= 0 ? "+" : ""}{n.avgProfit.toFixed(0)}€
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={styles.tip}>
          <Text style={styles.tipText}>
            💡 Règle d'or : rotation &gt; marge. Une niche qui vend en 3j à +8€ vaut mieux qu'une niche à +25€ en 30j.
          </Text>
        </View>
      </ScrollView>
    </ModalScreen>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  return <Text style={labelStyles.l}>{children}</Text>;
}
const labelStyles = StyleSheet.create({
  l: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
});

function StyledInput({ value, onChangeText, placeholder, keyboardType, testID }: {
  value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: "numeric" | "default"; testID?: string;
}) {
  return (
    <TextInput
      style={inputStyles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboardType ?? "default"}
      testID={testID}
    />
  );
}
const inputStyles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    color: colors.textPrimary, fontSize: 15, fontWeight: "700",
  },
});

function HistStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4, textAlign: "center" }}>{label}</Text>
      <Text style={{ color, fontSize: 16, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={calcStyles.row}>
      <Text style={calcStyles.label}>{label}</Text>
      <Text style={calcStyles.value}>{value}</Text>
    </View>
  );
}
const calcStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  label: { color: colors.textMuted, fontSize: 12 },
  value: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
});

function StatBox({ label, value, tone }: { label: string; value: string; tone?: "good" | "urgent" | "warning" | "neutral" }) {
  const col = tone === "good" ? colors.good : tone === "urgent" ? colors.urgent : tone === "warning" ? colors.warning : colors.textPrimary;
  return (
    <View style={sbStyles.box}>
      <Text style={sbStyles.label}>{label}</Text>
      <Text style={[sbStyles.value, { color: col }]}>{value}</Text>
    </View>
  );
}
const sbStyles = StyleSheet.create({
  box: { width: "48%", backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 12, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  value: { fontSize: 16, fontWeight: "900" },
});

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60 },
  row: { flexDirection: "row", gap: 10, marginBottom: 4 },
  inputGroup: { marginBottom: 12 },

  marketBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.info, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 16, marginBottom: 10, marginTop: 4,
  },
  marketBtnLoading: { backgroundColor: `${colors.info}80` },
  marketBtnText: { color: colors.bg, fontSize: 13, fontWeight: "800" },

  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 10, padding: 10, backgroundColor: colors.warningBg, borderRadius: 10, borderWidth: 1, borderColor: colors.warningBorder },
  errorText: { color: colors.warning, fontSize: 12, flex: 1, lineHeight: 17 },

  dropAlert: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10, padding: 12, backgroundColor: colors.urgentBg, borderRadius: 12, borderWidth: 1, borderColor: colors.urgentBorder },
  dropAlertTitle: { color: colors.urgent, fontSize: 13, fontWeight: "800" },
  dropAlertSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  marketCard: { marginBottom: 4 },
  samplesList: { borderTopWidth: 1, borderTopColor: colors.borderSoft, marginTop: 12, paddingTop: 8 },
  sampleRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  sampleBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  sampleTitle: { color: colors.textSecondary, fontSize: 12, flex: 1, marginRight: 8 },
  samplePrice: { fontSize: 13, fontWeight: "800" },
  marketSourceBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  marketSourceText: { color: colors.good, fontSize: 10, fontWeight: "700" },

  trendCard: { marginBottom: 4 },
  trendStats: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  trendLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  trendValue: { color: colors.textPrimary, fontSize: 15, fontWeight: "900" },
  trendDiff: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  trendPct: { fontSize: 12, fontWeight: "700", marginTop: 1 },

  historyCard: { marginBottom: 4 },
  histRow: { flexDirection: "row", marginBottom: 14 },
  bestSaleRow: { flexDirection: "row", alignItems: "center", marginTop: 10, flexWrap: "wrap" },
  bestSaleLabel: { color: colors.textMuted, fontSize: 12 },
  bestSaleValue: { fontSize: 12, fontWeight: "800" },

  maxPriceCard: { marginBottom: 4 },
  maxPriceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  maxPriceLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  maxPriceBig: { fontSize: 40, fontWeight: "900", letterSpacing: -2 },
  maxPriceVerdict: { alignItems: "flex-end" },
  verdictBig: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  verdictSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  calcBreakdown: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12 },
  calcTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderSoft, marginTop: 4 },
  calcTotalLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "800" },
  calcTotalValue: { fontSize: 15, fontWeight: "900" },

  resultCard: {},
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  verdictReason: { fontSize: 13, fontWeight: "700", flex: 1 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 12 },

  nicheRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  nicheBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  nicheRank: { fontSize: 14, fontWeight: "900", width: 24 },
  nicheName: { color: colors.textPrimary, fontSize: 13, fontWeight: "900" },
  nicheMeta: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  nicheProfit: { fontSize: 15, fontWeight: "900" },

  tip: { marginTop: 16, padding: 14, backgroundColor: colors.infoBg, borderRadius: 12, borderWidth: 1, borderColor: colors.infoBorder },
  tipText: { color: colors.info, fontSize: 12, lineHeight: 18 },
});
