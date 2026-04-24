import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatCard } from "../../src/components/StatCard";
import { Card, SectionTitle } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { colors } from "../../src/theme/colors";
import { computeNiches, globalWarnings } from "../../src/utils/logic";
import { computeDashboard, analyzeItem } from "../../src/utils/analytics";

export default function Dashboard() {
  const { stock, ventes, clients, retours } = useData();

  const kpi = useMemo(
    () => computeDashboard(stock, ventes, retours),
    [stock, ventes, retours]
  );

  const { relaunch, warnings, niches } = useMemo(() => {
    const now = Date.now();
    const relaunch = clients.filter((c) => {
      const diffH = (now - new Date(c.lastContact).getTime()) / 3600000;
      return c.status === "sans_reponse" && diffH >= 24;
    }).length;
    return {
      relaunch,
      warnings: globalWarnings(stock, retours),
      niches: computeNiches(ventes),
    };
  }, [stock, ventes, clients, retours]);

  const best = niches[0];
  const worst = niches.length > 1 ? niches[niches.length - 1] : null;

  const topAction = useMemo(() => {
    const analyzed = stock
      .map((s) => ({ item: s, a: analyzeItem(s, ventes, retours) }))
      .filter((x) => x.a.action !== "ANALYSE" && x.a.action !== "GARDER")
      .sort((a, b) => {
        const rank = (act: string) =>
          act === "SUPPRIMER" || act === "LIQUIDER"
            ? 0
            : act === "BAISSE_IMMEDIATE"
            ? 1
            : 2;
        return rank(a.a.action) - rank(b.a.action);
      });
    return analyzed.slice(0, 3);
  }, [stock, ventes, retours]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      testID="dashboard-scroll"
    >
      <ScreenHeader title="Dashboard" subtitle="Ton business en un coup d'œil" />

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
          label="CA total"
          value={`${kpi.ca.toFixed(0)} €`}
          tone="good"
          testID="stat-ca"
        />
        <StatCard
          label="Bénéfice"
          value={`${kpi.benefice.toFixed(0)} €`}
          tone={kpi.benefice >= 0 ? "good" : "urgent"}
          hint={`ROI ${kpi.roi.toFixed(0)}%`}
          testID="stat-profit"
        />
      </View>
      <View style={styles.grid}>
        <StatCard
          label="Délai moyen"
          value={`${kpi.avgDelay.toFixed(1)} j`}
          tone={kpi.avgDelay > 14 ? "urgent" : kpi.avgDelay > 7 ? "warning" : "good"}
          testID="stat-delay"
        />
        <StatCard
          label="Stock bloqué"
          value={`${kpi.stockBlocked.toFixed(0)} €`}
          hint={`${kpi.itemsCount} articles`}
          tone="warning"
          testID="stat-capital"
        />
      </View>

      <SectionTitle title="Décisions à prendre" />
      <View style={styles.grid}>
        <StatCard
          label="À baisser"
          value={`${kpi.toBaisser}`}
          tone={kpi.toBaisser > 0 ? "warning" : "good"}
          testID="kpi-baisser"
        />
        <StatCard
          label="À liquider"
          value={`${kpi.toLiquider}`}
          tone={kpi.toLiquider > 0 ? "urgent" : "good"}
          testID="kpi-liquider"
        />
      </View>
      <View style={styles.grid}>
        <StatCard
          label="Boostables"
          value={`${kpi.boostable}`}
          tone={kpi.boostable > 0 ? "good" : "neutral"}
          testID="kpi-boost"
        />
        <StatCard
          label="Clients relance"
          value={`${relaunch}`}
          tone={relaunch > 0 ? "warning" : "good"}
          testID="kpi-relaunch"
        />
      </View>

      {topAction.length > 0 && (
        <>
          <SectionTitle title="Actions prioritaires" />
          <Card testID="dashboard-actions">
            {topAction.map(({ item, a }, idx) => (
              <View
                key={item.id}
                style={[
                  styles.actionRow,
                  idx < topAction.length - 1 && styles.actionRowBorder,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionName}>{item.name}</Text>
                  <Text style={styles.actionMeta}>
                    {item.brand} • {a.time.days.toFixed(0)}j • {item.views} vues
                  </Text>
                </View>
                <Badge
                  label={a.action.replace("_", " ")}
                  tone={
                    a.action === "SUPPRIMER" || a.action === "LIQUIDER"
                      ? "urgent"
                      : "warning"
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle title="Niches" />
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
            {worst ? worst.brand.toUpperCase() : "—"}
          </Text>
          <Text style={styles.meta}>
            {worst
              ? `Score ${worst.score} • ${worst.count} ventes`
              : "Aucune donnée"}
          </Text>
        </Card>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 100 },
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  actionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  actionName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  actionMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
