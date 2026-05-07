import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatCard } from "../../src/components/StatCard";
import { Card, SectionTitle } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { ProgressBar } from "../../src/components/ProgressBar";
import { MiniBarChart } from "../../src/components/MiniBarChart";
import { colors } from "../../src/theme/colors";
import { computeNiches, globalWarnings } from "../../src/utils/logic";
import {
  computeDashboardFromAnalyzed,
  businessHealthScore,
} from "../../src/utils/analytics";
import { computeMonthlyStats } from "../../src/utils/monthly";
import {
  computeProjections,
  computeSaleStreak,
  currentMonthStats,
} from "../../src/utils/projections";
import { useAnalyzedStock } from "../../src/hooks/useAnalyzedStock";

const URGENCY_RANK: Record<string, number> = {
  SUPPRIMER: 0,
  LIQUIDER: 1,
  BAISSE_IMMEDIATE: 2,
  BAISSER: 3,
  REPOST: 4,
};

export default function Dashboard() {
  const { ventes, clients, retours, stock, goals } = useData();
  const analyzed = useAnalyzedStock();

  const data = useMemo(() => {
    const kpi = computeDashboardFromAnalyzed(analyzed, ventes);
    const health = businessHealthScore(kpi, analyzed, ventes, retours);
    const projection = computeProjections(analyzed, ventes);
    const thisMonth = currentMonthStats(ventes);
    const streak = computeSaleStreak(ventes);

    const monthly = computeMonthlyStats(ventes).slice(0, 6).reverse();
    const chartData = monthly.map((m, i) => ({
      label: m.label.slice(0, 3),
      value: m.profit,
      highlight: i === monthly.length - 1,
    }));

    const topAction = analyzed
      .filter(
        ({ analysis: a }) => a.action !== "ANALYSE" && a.action !== "GARDER"
      )
      .sort(
        (a, b) =>
          (URGENCY_RANK[a.analysis.action] ?? 9) -
          (URGENCY_RANK[b.analysis.action] ?? 9)
      )
      .slice(0, 4);

    const niches = computeNiches(ventes);
    const warnings = globalWarnings(stock, retours);
    const now = Date.now();
    const relaunch = clients.filter((c) => {
      const diffH = (now - new Date(c.lastContact).getTime()) / 3600000;
      return c.status === "sans_reponse" && diffH >= 24;
    }).length;

    return {
      kpi,
      health,
      projection,
      thisMonth,
      streak,
      chartData,
      topAction,
      best: niches[0] ?? null,
      worst: niches.length > 1 ? niches[niches.length - 1] : null,
      warnings,
      relaunch,
    };
  }, [analyzed, ventes, clients, retours, stock]);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const streakLabel =
    data.streak > 1
      ? `🔥 ${data.streak}j de suite`
      : data.streak === 1
      ? "🔥 Vente aujourd'hui"
      : "";

  const caProgress =
    goals.monthlyCAGoal > 0
      ? data.thisMonth.revenue / goals.monthlyCAGoal
      : 0;
  const profitProgress =
    goals.monthlyProfitGoal > 0
      ? data.thisMonth.profit / goals.monthlyProfitGoal
      : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      testID="dashboard-scroll"
    >
      <ScreenHeader
        title={greeting}
        subtitle={streakLabel || "Vinted Manager Pro"}
      />

      {/* ── ALERTES ── */}
      {data.warnings.length > 0 && (
        <Card style={styles.warningCard} testID="dashboard-warnings">
          <Text style={styles.warningTitle}>⚠ ALERTES</Text>
          {data.warnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>• {w}</Text>
          ))}
        </Card>
      )}

      {/* ── SANTÉ BUSINESS ── */}
      <Card style={styles.healthCard} testID="dashboard-health">
        <View style={styles.healthRow}>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreBig, { color: data.health.color }]}>
              {data.health.score}
            </Text>
            <Text style={styles.scoreOver}>/100</Text>
          </View>
          <View style={styles.healthRight}>
            <Text style={styles.healthLabel}>SANTÉ BUSINESS</Text>
            <Text style={[styles.healthVerdict, { color: data.health.color }]}>
              {data.health.label}
            </Text>
            <ProgressBar
              progress={data.health.score / 100}
              color={data.health.color}
              height={5}
            />
            <View style={styles.breakdownRow}>
              <BreakdownPill
                label="ROI"
                val={data.health.breakdown.roi}
                max={35}
                color={data.health.color}
              />
              <BreakdownPill
                label="Délai"
                val={data.health.breakdown.delay}
                max={30}
                color={data.health.color}
              />
              <BreakdownPill
                label="Stock"
                val={data.health.breakdown.deadStock}
                max={20}
                color={data.health.color}
              />
              <BreakdownPill
                label="Retours"
                val={data.health.breakdown.returns}
                max={15}
                color={data.health.color}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* ── KPIs ── */}
      <View style={styles.grid}>
        <StatCard
          label="CA total"
          value={`${data.kpi.ca.toFixed(0)} €`}
          hint={`${ventes.length} vente${ventes.length > 1 ? "s" : ""}`}
          tone="good"
          testID="stat-ca"
        />
        <StatCard
          label="Bénéfice net"
          value={`${data.kpi.benefice >= 0 ? "+" : ""}${data.kpi.benefice.toFixed(0)} €`}
          hint={`ROI ${data.kpi.roi.toFixed(0)}%`}
          tone={data.kpi.benefice >= 0 ? "good" : "urgent"}
          testID="stat-profit"
        />
      </View>
      <View style={styles.grid}>
        <StatCard
          label="Délai moyen"
          value={`${data.kpi.avgDelay.toFixed(1)} j`}
          tone={
            data.kpi.avgDelay === 0
              ? "neutral"
              : data.kpi.avgDelay > 14
              ? "urgent"
              : data.kpi.avgDelay > 7
              ? "warning"
              : "good"
          }
          testID="stat-delay"
        />
        <StatCard
          label="Capital bloqué"
          value={`${data.kpi.stockBlocked.toFixed(0)} €`}
          hint={`${data.kpi.itemsCount} article${data.kpi.itemsCount > 1 ? "s" : ""}`}
          tone="warning"
          testID="stat-capital"
        />
      </View>

      {/* ── PROJECTION + OBJECTIFS ── */}
      <SectionTitle title="Ce mois" subtitle="Réalisé vs objectif" />
      <Card testID="dashboard-projection">
        <View style={styles.projRow}>
          <View style={styles.projCol}>
            <Text style={styles.projLabel}>CA RÉALISÉ</Text>
            <Text style={[styles.projValue, { color: colors.good }]}>
              {data.thisMonth.revenue.toFixed(0)} €
            </Text>
          </View>
          <View style={styles.projDivider} />
          <View style={styles.projCol}>
            <Text style={styles.projLabel}>PROFIT RÉALISÉ</Text>
            <Text
              style={[
                styles.projValue,
                {
                  color:
                    data.thisMonth.profit >= 0 ? colors.good : colors.urgent,
                },
              ]}
            >
              {data.thisMonth.profit >= 0 ? "+" : ""}
              {data.thisMonth.profit.toFixed(0)} €
            </Text>
          </View>
          <View style={styles.projDivider} />
          <View style={styles.projCol}>
            <Text style={styles.projLabel}>VENTES</Text>
            <Text style={[styles.projValue, { color: colors.textPrimary }]}>
              {data.thisMonth.count}
            </Text>
          </View>
        </View>

        <View style={styles.separator} />

        <ProgressBar
          progress={caProgress}
          color={caProgress >= 1 ? colors.good : colors.warning}
          label="Objectif CA"
          valueLabel={`${data.thisMonth.revenue.toFixed(0)} / ${goals.monthlyCAGoal} €`}
          height={7}
        />
        <View style={{ height: 10 }} />
        <ProgressBar
          progress={profitProgress}
          color={profitProgress >= 1 ? colors.good : colors.info}
          label="Objectif profit"
          valueLabel={`${data.thisMonth.profit.toFixed(0)} / ${goals.monthlyProfitGoal} €`}
          height={7}
        />

        {data.projection.projectedProfit > 0 && (
          <View style={styles.projEstimate}>
            <Text style={styles.projEstimateText}>
              ~{data.projection.projectedProfit.toFixed(0)} € de profit estimé sur le stock restant
              {data.projection.highConfidenceCount > 0
                ? ` · ${data.projection.highConfidenceCount} article${data.projection.highConfidenceCount > 1 ? "s" : ""} à fort potentiel`
                : ""}
            </Text>
          </View>
        )}
      </Card>

      {/* ── MINI CHART MENSUEL ── */}
      {data.chartData.length > 1 && (
        <>
          <SectionTitle title="Historique profit" subtitle="6 derniers mois" />
          <Card testID="dashboard-chart">
            <MiniBarChart
              data={data.chartData}
              color={colors.good}
              height={52}
            />
          </Card>
        </>
      )}

      {/* ── DÉCISIONS ── */}
      <SectionTitle title="Décisions à prendre" />
      <View style={styles.grid}>
        <StatCard
          label="À baisser"
          value={`${data.kpi.toBaisser}`}
          tone={data.kpi.toBaisser > 0 ? "warning" : "good"}
          testID="kpi-baisser"
        />
        <StatCard
          label="À liquider"
          value={`${data.kpi.toLiquider}`}
          tone={data.kpi.toLiquider > 0 ? "urgent" : "good"}
          testID="kpi-liquider"
        />
      </View>
      <View style={styles.grid}>
        <StatCard
          label="Boostables"
          value={`${data.kpi.boostable}`}
          tone={data.kpi.boostable > 0 ? "good" : "neutral"}
          testID="kpi-boost"
        />
        <StatCard
          label="Clients relance"
          value={`${data.relaunch}`}
          tone={data.relaunch > 0 ? "warning" : "good"}
          testID="kpi-relaunch"
        />
      </View>

      {/* ── TOP ACTIONS ── */}
      {data.topAction.length > 0 && (
        <>
          <SectionTitle title="Actions prioritaires" />
          <Card testID="dashboard-actions">
            {data.topAction.map(({ item, analysis: a }, idx) => (
              <View
                key={item.id}
                style={[
                  styles.actionRow,
                  idx < data.topAction.length - 1 && styles.actionBorder,
                ]}
              >
                <View
                  style={[
                    styles.urgencyBar,
                    {
                      backgroundColor:
                        a.action === "SUPPRIMER" || a.action === "LIQUIDER"
                          ? colors.urgent
                          : a.action === "BAISSE_IMMEDIATE"
                          ? colors.warning
                          : colors.info,
                    },
                  ]}
                />
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={styles.actionName}>{item.name}</Text>
                  <Text style={styles.actionMeta}>
                    {item.brand} · {a.time.days.toFixed(0)}j · {item.views} vues
                  </Text>
                </View>
                <Badge
                  label={a.action.replace("_", " ")}
                  tone={
                    a.action === "SUPPRIMER" || a.action === "LIQUIDER"
                      ? "urgent"
                      : a.action === "BAISSE_IMMEDIATE"
                      ? "warning"
                      : "info"
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {/* ── NICHES ── */}
      <SectionTitle title="Niches" subtitle="Basé sur tes ventes" />
      <View style={styles.grid}>
        <Card style={styles.nicheCard} testID="dashboard-best-niche">
          <Text style={styles.nicheBadge}>★ MEILLEURE</Text>
          <Text style={[styles.nicheBrand, { color: colors.good }]}>
            {data.best ? data.best.brand.toUpperCase() : "—"}
          </Text>
          <Text style={styles.nicheMeta}>
            {data.best
              ? `+${data.best.avgProfit.toFixed(0)}€/art · ${data.best.count} ventes`
              : "Pas encore de données"}
          </Text>
        </Card>
        <Card style={styles.nicheCard} testID="dashboard-worst-niche">
          <Text style={[styles.nicheBadge, { color: colors.urgent }]}>
            ✕ PIRE
          </Text>
          <Text style={[styles.nicheBrand, { color: colors.urgent }]}>
            {data.worst ? data.worst.brand.toUpperCase() : "—"}
          </Text>
          <Text style={styles.nicheMeta}>
            {data.worst
              ? `${data.worst.avgProfit.toFixed(0)}€/art · ${data.worst.count} ventes`
              : "—"}
          </Text>
        </Card>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function BreakdownPill({
  label,
  val,
  max,
  color,
}: {
  label: string;
  val: number;
  max: number;
  color: string;
}) {
  const ratio = val / max;
  return (
    <View style={bStyles.pill}>
      <Text style={bStyles.label}>{label}</Text>
      <View style={bStyles.track}>
        <View
          style={[
            bStyles.fill,
            { width: `${ratio * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

const bStyles = StyleSheet.create({
  pill: { flex: 1, alignItems: "center" },
  label: { color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginBottom: 3 },
  track: { width: "100%", height: 3, backgroundColor: colors.surfaceElevated, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, borderRadius: 2 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 100 },

  warningCard: {
    marginBottom: 14,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningBg,
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },
  warningText: { color: colors.textPrimary, fontSize: 13, marginBottom: 3 },

  healthCard: {
    marginBottom: 14,
    borderColor: colors.borderSoft,
  },
  healthRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  scoreBox: { alignItems: "center" },
  scoreBig: { fontSize: 48, fontWeight: "900", letterSpacing: -2, lineHeight: 52 },
  scoreOver: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: -4 },
  healthRight: { flex: 1, gap: 6 },
  healthLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  healthVerdict: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  breakdownRow: { flexDirection: "row", gap: 6, marginTop: 4 },

  grid: { flexDirection: "row", gap: 10, marginBottom: 10 },

  projRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  projCol: { flex: 1, alignItems: "center" },
  projDivider: { width: 1, height: 36, backgroundColor: colors.borderSoft },
  projLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  projValue: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  separator: { height: 1, backgroundColor: colors.borderSoft, marginBottom: 14 },
  projEstimate: {
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.goodBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goodBorder,
  },
  projEstimateText: { color: colors.good, fontSize: 12, fontWeight: "700", lineHeight: 18 },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },
  actionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  urgencyBar: { width: 3, height: 36, borderRadius: 2 },
  actionName: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  actionMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  nicheCard: { flex: 1 },
  nicheBadge: { color: colors.good, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 },
  nicheBrand: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  nicheMeta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
