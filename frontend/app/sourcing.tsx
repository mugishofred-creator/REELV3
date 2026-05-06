import React, { useMemo, useState } from "react";
import {
  ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity,
} from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card, SectionTitle } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { ProgressBar } from "../src/components/ProgressBar";
import { colors } from "../src/theme/colors";
import { useData } from "../src/store/context";
import { sourcingAnalyze, type Sourcing as SourcingVerdict } from "../src/utils/analytics";
import { computeNiches } from "../src/utils/logic";

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

  const buyNum = Number(buyPrice) || 0;
  const feesNum = Number(fees) || 0;
  const targetNum = Number(targetProfit) || 15;

  // ── Historique marque ──
  const brandHistory = useMemo(() => {
    const bl = brand.trim().toLowerCase();
    if (!bl) return null;
    const sales = ventes.filter((v) => v.brand.toLowerCase() === bl);
    if (sales.length === 0) return null;
    const avgSell = sales.reduce((s, v) => s + v.sellPrice, 0) / sales.length;
    const avgDelay = sales.reduce((s, v) => s + (v.delay || 0), 0) / sales.length;
    const profits = sales.map((v) => v.sellPrice - v.buyPrice - (v.fees || 0) - (v.boostCost || 0));
    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const bestSale = profits.reduce((best, p, i) => p > best.profit ? { profit: p, sale: sales[i] } : best, { profit: -Infinity, sale: sales[0] });
    const winRate = profits.filter((p) => p > 0).length / profits.length;
    return { count: sales.length, avgSell, avgDelay, avgProfit, bestSale, winRate };
  }, [brand, ventes]);

  // ── Prix max achat (pour atteindre targetProfit) ──
  const maxBuyPrice = useMemo(() => {
    if (!brandHistory) return null;
    return Math.max(0, brandHistory.avgSell - targetNum - feesNum);
  }, [brandHistory, targetNum, feesNum]);

  // ── Analyse sourcing (calcul en temps réel) ──
  const result = useMemo(() => {
    if (!brand.trim() || buyNum <= 0) return null;
    return sourcingAnalyze(brand.trim(), category.trim(), buyNum, ventes, feesNum);
  }, [brand, category, buyNum, ventes, feesNum]);

  // ── Top niches ──
  const topNiches = useMemo(() => computeNiches(ventes).slice(0, 5), [ventes]);

  const marginOK = result?.profit !== null && result?.profit !== undefined && result.profit >= 0;
  const isGoodDeal = buyNum > 0 && maxBuyPrice !== null && buyNum <= maxBuyPrice;

  return (
    <ModalScreen title="Sourcing IA" subtitle="Analyse instantanée · prix max · verdict">
      <ScrollView contentContainerStyle={styles.content} testID="sourcing-scroll" keyboardShouldPersistTaps="handled">

        {/* ── FORMULAIRE ── */}
        <View style={styles.inputGroup}>
          <Label>Marque</Label>
          <StyledInput
            value={brand}
            onChangeText={setBrand}
            placeholder="Carhartt, Levi's, Nike…"
            testID="sourcing-brand"
          />
        </View>

        <View style={styles.inputGroup}>
          <Label>Catégorie</Label>
          <StyledInput
            value={category}
            onChangeText={setCategory}
            placeholder="cargo, workwear, jean…"
            testID="sourcing-category"
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Label>Prix achat (€)</Label>
            <StyledInput
              value={buyPrice}
              onChangeText={setBuyPrice}
              placeholder="0"
              keyboardType="numeric"
              testID="sourcing-price"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Frais (€)</Label>
            <StyledInput
              value={fees}
              onChangeText={setFees}
              placeholder="0"
              keyboardType="numeric"
              testID="sourcing-fees"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Profit cible (€)</Label>
            <StyledInput
              value={targetProfit}
              onChangeText={setTargetProfit}
              placeholder="15"
              keyboardType="numeric"
              testID="sourcing-target"
            />
          </View>
        </View>

        {/* ── HISTORIQUE MARQUE ── */}
        {brandHistory && (
          <>
            <SectionTitle title={`Historique ${brand.trim().toUpperCase()}`} subtitle={`${brandHistory.count} vente${brandHistory.count > 1 ? "s" : ""} dans ta base`} />
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
        {maxBuyPrice !== null && (
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
                        <Text style={styles.verdictSub}>
                          Dépasse de {(buyNum - maxBuyPrice).toFixed(0)}€
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.calcBreakdown}>
                <CalcRow label="Prix vente moyen marché" value={`${brandHistory!.avgSell.toFixed(0)} €`} />
                <CalcRow label={`Profit cible`} value={`− ${targetNum} €`} />
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
                <StatBox label="Prix moyen marché" value={result.avgSell > 0 ? `${result.avgSell.toFixed(0)} €` : "—"} />
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
                  <Text style={[styles.nicheRank, { color: i === 0 ? colors.good : colors.textMuted }]}>
                    #{i + 1}
                  </Text>
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
