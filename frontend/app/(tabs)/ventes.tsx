import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { StatCard } from "../../src/components/StatCard";
import { MiniBarChart } from "../../src/components/MiniBarChart";
import { ProgressBar } from "../../src/components/ProgressBar";
import { colors } from "../../src/theme/colors";
import { computeNiches } from "../../src/utils/logic";
import { computeMonthlyStats } from "../../src/utils/monthly";
import { computeRecords } from "../../src/utils/projections";
import { computeBestHours } from "../../src/utils/marketHistory";

export default function VentesScreen() {
  const { ventes } = useData();

  const { stats, niches, monthly, chart, records, bestHours } = useMemo(() => {
    const totalCA = ventes.reduce((s, v) => s + (v.sellPrice || 0), 0);
    const totalProfit = ventes.reduce(
      (s, v) => s + (v.sellPrice || 0) - (v.buyPrice || 0) - (v.fees || 0) - (v.boostCost || 0),
      0
    );
    const totalFees = ventes.reduce((s, v) => s + (v.fees || 0) + (v.boostCost || 0), 0);
    const avgDelay =
      ventes.reduce((s, v) => s + (v.delay || 0), 0) / Math.max(1, ventes.length);

    const monthly = computeMonthlyStats(ventes).slice(0, 6).reverse();
    const chart = monthly.map((m, i) => ({
      label: m.label.slice(0, 3),
      value: m.profit,
      highlight: i === monthly.length - 1,
    }));

    return {
      stats: {
        totalCA: Math.round(totalCA * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        avgDelay: Math.round(avgDelay * 10) / 10,
        count: ventes.length,
      },
      niches: computeNiches(ventes),
      monthly,
      chart,
      records: computeRecords(ventes),
      bestHours: computeBestHours(ventes.map((v) => v.date), 5),
    };
  }, [ventes]);

  const bestMonth = monthly.length
    ? monthly.reduce((b, m) => (m.profit > b.profit ? m : b), monthly[0])
    : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      testID="ventes-scroll"
    >
      <ScreenHeader title="Ventes" subtitle="Historique & intelligence marché" />

      {/* ── KPIs ── */}
      <View style={styles.grid}>
        <StatCard label="CA total" value={`${stats.totalCA.toFixed(0)} €`} tone="good" testID="ventes-ca" />
        <StatCard
          label="Profit net"
          value={`${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(0)} €`}
          tone={stats.totalProfit >= 0 ? "good" : "urgent"}
          testID="ventes-profit"
        />
      </View>
      <View style={styles.grid}>
        <StatCard label="Ventes" value={`${stats.count}`} testID="ventes-count" />
        <StatCard
          label="Délai moyen"
          value={`${stats.avgDelay} j`}
          tone={stats.avgDelay > 14 ? "warning" : stats.avgDelay > 7 ? "neutral" : "good"}
          testID="ventes-delay"
        />
      </View>
      {stats.totalFees > 0 && (
        <Card style={styles.feesCard}>
          <Text style={styles.feesText}>
            Frais totaux payés (Vinted + boosts) :{" "}
            <Text style={{ color: colors.urgent, fontWeight: "900" }}>
              {stats.totalFees.toFixed(0)} €
            </Text>
          </Text>
        </Card>
      )}

      {/* ── RECORDS ── */}
      {ventes.length >= 2 && (
        <>
          <SectionTitle title="Records" subtitle="Tes meilleures performances" />
          <View style={styles.recordsGrid}>
            {records.fastestSale && (
              <Card style={styles.recordCard}>
                <Text style={styles.recordIcon}>⚡</Text>
                <Text style={styles.recordLabel}>Vente la + rapide</Text>
                <Text style={styles.recordValue}>{records.fastestSale.delay}j</Text>
                <Text style={styles.recordName} numberOfLines={1}>
                  {records.fastestSale.name}
                </Text>
              </Card>
            )}
            {records.bestMargin && (
              <Card style={styles.recordCard}>
                <Text style={styles.recordIcon}>💰</Text>
                <Text style={styles.recordLabel}>Meilleure marge</Text>
                <Text style={[styles.recordValue, { color: colors.good }]}>
                  +{records.bestMargin.profit.toFixed(0)}€
                </Text>
                <Text style={styles.recordName} numberOfLines={1}>
                  {records.bestMargin.name}
                </Text>
              </Card>
            )}
            {records.bestBrand && (
              <Card style={styles.recordCard}>
                <Text style={styles.recordIcon}>🏆</Text>
                <Text style={styles.recordLabel}>Meilleure marque</Text>
                <Text style={[styles.recordValue, { color: colors.good }]}>
                  {records.bestBrand.brand.toUpperCase()}
                </Text>
                <Text style={styles.recordName}>
                  moy. +{records.bestBrand.avgProfit.toFixed(0)}€ · {records.bestBrand.count} ventes
                </Text>
              </Card>
            )}
          </View>
        </>
      )}

      {/* ── GRAPHIQUE MENSUEL ── */}
      <SectionTitle
        title="Profit mensuel"
        subtitle={bestMonth ? `Meilleur mois : ${bestMonth.label} · +${bestMonth.profit.toFixed(0)}€` : "Tendance des 6 derniers mois"}
      />
      {monthly.length === 0 ? (
        <Card><Text style={styles.empty}>Pas encore de données mensuelles.</Text></Card>
      ) : (
        <>
          {chart.length > 1 && (
            <Card style={styles.chartCard}>
              <MiniBarChart data={chart} color={colors.good} height={56} />
            </Card>
          )}
          {monthly.map((m) => (
            <Card key={m.key} style={styles.monthCard} testID={`month-${m.key}`}>
              <View style={styles.monthHead}>
                <Text style={styles.monthLabel}>{m.label.toUpperCase()}</Text>
                <Text style={[styles.monthProfit, { color: m.profit >= 0 ? colors.good : colors.urgent }]}>
                  {m.profit >= 0 ? "+" : ""}{m.profit.toFixed(0)} €
                </Text>
              </View>
              <View style={styles.monthRow}>
                <MonthStat label="Ventes" value={`${m.count}`} />
                <MonthStat label="CA" value={`${m.revenue.toFixed(0)}€`} />
                <MonthStat label="Délai" value={`${m.avgDelay}j`} />
                <MonthStat
                  label="ROI"
                  value={`${Math.round(m.roi * 100)}%`}
                  tone={m.roi >= 0.3 ? "good" : m.roi >= 0 ? "warning" : "urgent"}
                />
              </View>
            </Card>
          ))}
        </>
      )}

      {/* ── NICHES / MARQUES ── */}
      <SectionTitle title="Intelligence marché" subtitle="Profit moyen par marque" />
      {niches.length === 0 ? (
        <Card><Text style={styles.empty}>Aucune vente. Enregistre-en depuis l'onglet Stock.</Text></Card>
      ) : (
        <Card>
          {niches.map((n, idx) => (
            <View
              key={n.brand}
              style={[styles.brandRow, idx < niches.length - 1 && styles.brandBorder]}
              testID={`ventes-brand-${n.brand}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.brandName}>{n.brand.toUpperCase()}</Text>
                <Text style={styles.brandMeta}>
                  {n.count} vente{n.count > 1 ? "s" : ""} · {n.avgDelay}j moy.
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.brandProfit, { color: n.avgProfit >= 0 ? colors.good : colors.urgent }]}>
                  {n.avgProfit >= 0 ? "+" : ""}{n.avgProfit.toFixed(1)} €
                </Text>
                <Text style={styles.brandSuccess}>
                  {Math.round(n.successRate * 100)}% gagnants
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* ── MEILLEURE HEURE ── */}
      {bestHours.length >= 3 && (
        <>
          <SectionTitle title="Meilleure heure de publication" subtitle="Créneaux où tu vends le plus" />
          <Card testID="ventes-best-hours">
            {bestHours.map((h, i) => (
              <View key={h.hour} style={[styles.hourRow, i < bestHours.length - 1 && styles.brandBorder]}>
                <Text style={[styles.hourRank, { color: i === 0 ? colors.good : colors.textMuted }]}>
                  #{i + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hourLabel}>{h.label}</Text>
                </View>
                <View style={styles.hourBarWrap}>
                  <ProgressBar
                    progress={h.count / bestHours[0].count}
                    color={i === 0 ? colors.good : colors.info}
                    height={5}
                  />
                </View>
                <Text style={[styles.hourCount, { color: i === 0 ? colors.good : colors.textSecondary }]}>
                  {h.count} vente{h.count > 1 ? "s" : ""}
                </Text>
              </View>
            ))}
            <View style={styles.hourTip}>
              <Text style={styles.hourTipText}>
                💡 Publie entre {bestHours[0].label} pour maximiser ta visibilité
              </Text>
            </View>
          </Card>
        </>
      )}

      {/* ── HISTORIQUE ── */}
      <SectionTitle title="Dernières ventes" />
      {ventes.length === 0 ? (
        <Card><Text style={styles.empty}>Aucune vente enregistrée.</Text></Card>
      ) : (
        <Card>
          {ventes.slice(0, 20).map((v, idx) => {
            const profit = (v.sellPrice || 0) - (v.buyPrice || 0) - (v.fees || 0) - (v.boostCost || 0);
            return (
              <View
                key={v.id}
                style={[styles.venteRow, idx < Math.min(ventes.length, 20) - 1 && styles.brandBorder]}
                testID={`vente-${v.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.venteName}>{v.name}</Text>
                  <Text style={styles.brandMeta}>
                    {v.brand} · {new Date(v.date).toLocaleDateString("fr-FR")} · {v.delay}j
                  </Text>
                </View>
                <Text style={[styles.venteProfit, { color: profit >= 0 ? colors.good : colors.urgent }]}>
                  {profit >= 0 ? "+" : ""}{profit.toFixed(0)} €
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MonthStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "urgent" | "warning" }) {
  const col = tone === "good" ? colors.good : tone === "urgent" ? colors.urgent : tone === "warning" ? colors.warning : colors.textPrimary;
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: col, fontSize: 14, fontWeight: "900", marginTop: 3 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 130 },
  grid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  empty: { color: colors.textMuted, textAlign: "center" },

  feesCard: { marginBottom: 12, backgroundColor: colors.urgentBg, borderColor: colors.urgentBorder },
  feesText: { color: colors.textSecondary, fontSize: 13 },

  recordsGrid: { flexDirection: "row", gap: 10, marginBottom: 4, flexWrap: "wrap" },
  recordCard: { flex: 1, minWidth: "30%", alignItems: "center", paddingVertical: 14 },
  recordIcon: { fontSize: 20, marginBottom: 6 },
  recordLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, textAlign: "center" },
  recordValue: { color: colors.textPrimary, fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  recordName: { color: colors.textMuted, fontSize: 10, marginTop: 3, textAlign: "center" },

  chartCard: { marginBottom: 10 },
  monthCard: { marginBottom: 10 },
  monthHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  monthLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  monthProfit: { fontSize: 17, fontWeight: "900" },
  monthRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10 },

  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  brandBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  brandName: { color: colors.textPrimary, fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
  brandMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  brandProfit: { fontSize: 15, fontWeight: "900" },
  brandSuccess: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  venteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  venteName: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  venteProfit: { fontSize: 15, fontWeight: "900" },

  hourRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  hourRank: { fontSize: 13, fontWeight: "900", width: 22 },
  hourLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  hourBarWrap: { flex: 1 },
  hourCount: { fontSize: 12, fontWeight: "800", minWidth: 56, textAlign: "right" },
  hourTip: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  hourTipText: { color: colors.info, fontSize: 12, lineHeight: 17 },
});
