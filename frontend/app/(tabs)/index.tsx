import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatCard } from "../../src/components/StatCard";
import { Card, SectionTitle } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { colors } from "../../src/theme/colors";
import {
  computeScore,
  computeDecision,
  listingFlag,
  computeNiches,
  globalWarnings,
} from "../../src/utils/logic";

export default function Dashboard() {
  const { stock, ventes, clients, retours } = useData();

  const {
    totalProfit,
    capitalBlocked,
    itemsCount,
    urgent,
    weakListings,
    relaunch,
    niches,
    warnings,
  } = useMemo(() => {
    const totalProfit = ventes.reduce(
      (s, v) => s + ((v.sellPrice || 0) - (v.buyPrice || 0)),
      0
    );
    const capitalBlocked = stock.reduce((s, x) => s + (x.buyPrice || 0), 0);
    const urgentItems = stock.filter((x) => {
      const d = computeDecision(x, computeScore(x, retours));
      return d === "SUPPRIMER" || d === "LIQUIDER";
    }).length;
    const weak = stock.filter((x) => listingFlag(x)).length;
    const now = Date.now();
    const relaunch = clients.filter((c) => {
      const diffH = (now - new Date(c.lastContact).getTime()) / 3600000;
      return c.status === "sans_reponse" && diffH >= 24;
    }).length;
    const n = computeNiches(ventes);
    return {
      totalProfit,
      capitalBlocked,
      itemsCount: stock.length,
      urgent: urgentItems,
      weakListings: weak,
      relaunch,
      niches: n,
      warnings: globalWarnings(stock, retours),
    };
  }, [stock, ventes, clients, retours]);

  const best = niches[0];
  const worst = niches[niches.length - 1];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      testID="dashboard-scroll"
    >
      <ScreenHeader
        title="Dashboard"
        subtitle="Vue d'ensemble de ton business"
      />

      {warnings.length > 0 && (
        <Card style={styles.warningBox} testID="dashboard-warnings">
          <Text style={styles.warningTitle}>⚠ ALERTES</Text>
          {warnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>
              • {w}
            </Text>
          ))}
        </Card>
      )}

      <View style={styles.grid}>
        <StatCard
          label="Profit total"
          value={`${totalProfit.toFixed(0)} €`}
          tone={totalProfit >= 0 ? "good" : "urgent"}
          testID="stat-profit"
        />
        <StatCard
          label="Articles"
          value={`${itemsCount}`}
          hint="en stock"
          testID="stat-items"
        />
      </View>
      <View style={styles.grid}>
        <StatCard
          label="Capital bloqué"
          value={`${capitalBlocked.toFixed(0)} €`}
          tone="warning"
          testID="stat-capital"
        />
        <StatCard
          label="Actions urgentes"
          value={`${urgent + relaunch + weakListings}`}
          tone={urgent + relaunch + weakListings > 0 ? "urgent" : "good"}
          testID="stat-urgent"
        />
      </View>

      <SectionTitle title="Niches" subtitle="Meilleure / pire performance" />
      <View style={styles.row}>
        <Card style={styles.half} testID="dashboard-best-niche">
          <Badge label="Meilleure" tone="good" />
          <Text style={styles.brand}>
            {best ? best.brand.toUpperCase() : "—"}
          </Text>
          <Text style={styles.meta}>
            {best ? `Score ${best.score} • ${best.count} ventes` : "Aucune donnée"}
          </Text>
        </Card>
        <Card style={styles.half} testID="dashboard-worst-niche">
          <Badge label="Pire" tone="urgent" />
          <Text style={styles.brand}>
            {worst && worst !== best ? worst.brand.toUpperCase() : "—"}
          </Text>
          <Text style={styles.meta}>
            {worst && worst !== best
              ? `Score ${worst.score} • ${worst.count} ventes`
              : "Aucune donnée"}
          </Text>
        </Card>
      </View>

      <SectionTitle title="À surveiller" />
      <Card testID="dashboard-watchlist">
        <Row label="Annonces faibles" value={`${weakListings}`} tone="warning" />
        <Row label="Clients à relancer" value={`${relaunch}`} tone="warning" />
        <Row
          label="Stock à supprimer/liquider"
          value={`${urgent}`}
          tone="urgent"
        />
        <Row
          label="Retours enregistrés"
          value={`${retours.length}`}
          tone="neutral"
        />
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "urgent" | "warning" | "neutral";
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
    <View style={styles.rowItem}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: col }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 80 },
  grid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  brand: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
    letterSpacing: -0.3,
  },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 14 },
  rowValue: { fontSize: 16, fontWeight: "800" },
  warningBox: {
    marginBottom: 16,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningBg,
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },
  warningText: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
  },
});
