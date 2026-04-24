import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { StatCard } from "../../src/components/StatCard";
import { colors } from "../../src/theme/colors";
import { computeNiches } from "../../src/utils/logic";
import { computeMonthlyStats } from "../../src/utils/monthly";

export default function VentesScreen() {
  const { ventes } = useData();

  const stats = useMemo(() => {
    const totalCA = ventes.reduce((s, v) => s + (v.sellPrice || 0), 0);
    const totalProfit = ventes.reduce(
      (s, v) => s + ((v.sellPrice || 0) - (v.buyPrice || 0)),
      0
    );
    const avgDelay =
      ventes.reduce((s, v) => s + (v.delay || 0), 0) /
      Math.max(1, ventes.length);
    return {
      totalCA,
      totalProfit,
      avgDelay: Math.round(avgDelay * 10) / 10,
      count: ventes.length,
    };
  }, [ventes]);

  const niches = useMemo(() => computeNiches(ventes), [ventes]);

  const monthly = useMemo(() => computeMonthlyStats(ventes), [ventes]);

  const bestMonth = useMemo(() => {
    if (monthly.length === 0) return null;
    return monthly.reduce((best, m) => (m.profit > best.profit ? m : best), monthly[0]);
  }, [monthly]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      testID="ventes-scroll"
    >
      <ScreenHeader
        title="Ventes"
        subtitle="Historique et apprentissage"
      />

      <View style={styles.grid}>
        <StatCard
          label="CA total"
          value={`${stats.totalCA.toFixed(0)} €`}
          testID="ventes-ca"
        />
        <StatCard
          label="Profit"
          value={`${stats.totalProfit.toFixed(0)} €`}
          tone={stats.totalProfit >= 0 ? "good" : "urgent"}
          testID="ventes-profit"
        />
      </View>
      <View style={styles.grid}>
        <StatCard
          label="Ventes"
          value={`${stats.count}`}
          testID="ventes-count"
        />
        <StatCard
          label="Délai moyen"
          value={`${stats.avgDelay} j`}
          tone={stats.avgDelay > 14 ? "warning" : "good"}
          testID="ventes-delay"
        />
      </View>

      <SectionTitle
        title="Performances mensuelles"
        subtitle={
          bestMonth
            ? `Meilleur mois : ${bestMonth.label} • +${bestMonth.profit}€`
            : "Ton ROI par mois"
        }
      />
      {monthly.length === 0 ? (
        <Card>
          <Text style={styles.empty}>Pas encore de données mensuelles.</Text>
        </Card>
      ) : (
        monthly.map((m) => (
          <Card key={m.key} style={styles.monthCard} testID={`month-${m.key}`}>
            <View style={styles.monthHead}>
              <Text style={styles.monthLabel}>{m.label.toUpperCase()}</Text>
              <Text
                style={[
                  styles.monthProfit,
                  { color: m.profit >= 0 ? colors.good : colors.urgent },
                ]}
              >
                {m.profit >= 0 ? "+" : ""}
                {m.profit.toFixed(0)} €
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
        ))
      )}

      <SectionTitle title="Prix moyens par marque" subtitle="Utilisé pour le sourcing" />
      {niches.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            Aucune vente pour le moment. Enregistre une vente depuis l'onglet Stock.
          </Text>
        </Card>
      ) : (
        <Card>
          {niches.map((n, idx) => (
            <View
              key={n.brand}
              style={[
                styles.brandRow,
                idx < niches.length - 1 && styles.brandRowBorder,
              ]}
              testID={`ventes-brand-${n.brand}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.brandName}>{n.brand.toUpperCase()}</Text>
                <Text style={styles.brandMeta}>
                  {n.count} vente{n.count > 1 ? "s" : ""} • {n.avgDelay}j
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.brandProfit,
                    { color: n.avgProfit >= 0 ? colors.good : colors.urgent },
                  ]}
                >
                  {n.avgProfit >= 0 ? "+" : ""}
                  {n.avgProfit.toFixed(1)} €
                </Text>
                <Text style={styles.brandSuccess}>
                  {Math.round(n.successRate * 100)}% gagnants
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      <SectionTitle title="Dernières ventes" />
      {ventes.length === 0 ? (
        <Card>
          <Text style={styles.empty}>Aucune vente enregistrée.</Text>
        </Card>
      ) : (
        <Card>
          {ventes.slice(0, 20).map((v, idx) => {
            const profit = (v.sellPrice || 0) - (v.buyPrice || 0);
            return (
              <View
                key={v.id}
                style={[
                  styles.venteRow,
                  idx < Math.min(ventes.length, 20) - 1 && styles.brandRowBorder,
                ]}
                testID={`vente-${v.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.venteName}>{v.name}</Text>
                  <Text style={styles.brandMeta}>
                    {v.brand} • {new Date(v.date).toLocaleDateString("fr-FR")}{" "}
                    • {v.delay}j
                  </Text>
                </View>
                <Text
                  style={[
                    styles.venteProfit,
                    { color: profit >= 0 ? colors.good : colors.urgent },
                  ]}
                >
                  {profit >= 0 ? "+" : ""}
                  {profit.toFixed(0)} €
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

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 100 },
  grid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  empty: { color: colors.textMuted, textAlign: "center" },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  brandRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  brandName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  brandMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  brandProfit: { fontSize: 15, fontWeight: "900" },
  brandSuccess: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  venteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  venteName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  venteProfit: { fontSize: 15, fontWeight: "900" },
  monthCard: { marginBottom: 10 },
  monthHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  monthProfit: { fontSize: 17, fontWeight: "900" },
  monthRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 10,
  },
});

function MonthStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "urgent" | "warning";
}) {
  const col =
    tone === "good"
      ? colors.good
      : tone === "urgent"
      ? colors.urgent
      : tone === "warning"
      ? colors.warning
      : colors.textPrimary;
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: col, fontSize: 14, fontWeight: "900", marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}
