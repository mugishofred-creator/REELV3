import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card, SectionTitle } from "../src/components/Card";
import { MiniBarChart } from "../src/components/MiniBarChart";
import { useData } from "../src/store/context";
import { colors } from "../src/theme/colors";

// ─── helpers ────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function venteProfitOf(v: { sellPrice: number; buyPrice: number; fees?: number; boostCost?: number }): number {
  return v.sellPrice - v.buyPrice - (v.fees ?? 0) - (v.boostCost ?? 0);
}

function fmt(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "€";
}

function fmtPos(n: number): string {
  return n.toFixed(2) + "€";
}

function dayLabel(idx: number): string {
  return ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][idx];
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue} numberOfLines={1}>
        <Text style={accent ? { color: accent } : undefined}>{value}</Text>
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── screen ─────────────────────────────────────────────────────────────────

export default function PerformanceScreen() {
  const { ventes } = useData();

  // ── 1. Summary ────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalProfitRaw = ventes.reduce((acc, v) => acc + venteProfitOf(v), 0);
    const totalBuy = ventes.reduce((acc, v) => acc + v.buyPrice, 0);
    const roi = totalBuy > 0 ? (totalProfitRaw / totalBuy) * 100 : 0;
    return {
      count: ventes.length,
      totalProfit: totalProfitRaw,
      roi,
    };
  }, [ventes]);

  // ── 2. Weekly profit chart (last 8 weeks) ─────────────────────────────────
  const weeklyChartData = useMemo(() => {
    const profitByWeek: Record<string, number> = {};
    for (const v of ventes) {
      const key = getWeekStart(new Date(v.date));
      profitByWeek[key] = (profitByWeek[key] ?? 0) + venteProfitOf(v);
    }

    // build last 8 weeks starting from Monday
    const weeks: Array<{ key: string; start: Date }> = [];
    const now = new Date();
    const todayWeekStart = new Date(now);
    const todayDay = todayWeekStart.getDay();
    const diff = todayDay === 0 ? -6 : 1 - todayDay;
    todayWeekStart.setDate(todayWeekStart.getDate() + diff);
    todayWeekStart.setHours(0, 0, 0, 0);

    for (let i = 7; i >= 0; i--) {
      const d = new Date(todayWeekStart);
      d.setDate(d.getDate() - i * 7);
      weeks.push({ key: d.toISOString().slice(0, 10), start: d });
    }

    return weeks.map((w, idx) => {
      const dd = w.start.getDate().toString().padStart(2, "0");
      const mm = (w.start.getMonth() + 1).toString().padStart(2, "0");
      return {
        label: `${dd}/${mm}`,
        value: profitByWeek[w.key] ?? 0,
        highlight: idx === weeks.length - 1,
      };
    });
  }, [ventes]);

  // ── 3. Day of week heatmap ────────────────────────────────────────────────
  const dayStats = useMemo(() => {
    // 0=Mon .. 6=Dim (mapped from JS 0=Sun)
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const v of ventes) {
      const jsDay = new Date(v.date).getDay(); // 0=Sun
      const mapped = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
      counts[mapped] += 1;
    }
    const maxCount = Math.max(...counts, 1);
    return counts.map((count, idx) => ({ idx, count, maxCount }));
  }, [ventes]);

  // ── 4. Price range performance ────────────────────────────────────────────
  type PriceRange = { label: string; min: number; max: number };
  const priceRanges: PriceRange[] = [
    { label: "<10€", min: 0, max: 10 },
    { label: "10–20€", min: 10, max: 20 },
    { label: "20–30€", min: 20, max: 30 },
    { label: "30–50€", min: 30, max: 50 },
    { label: ">50€", min: 50, max: Infinity },
  ];

  const priceRangeStats = useMemo(() => {
    return priceRanges.map((range) => {
      const items = ventes.filter(
        (v) => v.sellPrice >= range.min && v.sellPrice < range.max
      );
      const count = items.length;
      const avgDelay = count > 0 ? items.reduce((a, v) => a + v.delay, 0) / count : 0;
      const avgProfit = count > 0 ? items.reduce((a, v) => a + venteProfitOf(v), 0) / count : 0;
      return { label: range.label, count, avgDelay, avgProfit };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventes]);

  // ── 5. Top brands ─────────────────────────────────────────────────────────
  const brandStats = useMemo(() => {
    const map: Record<string, { totalProfit: number; count: number }> = {};
    for (const v of ventes) {
      const key = v.brand.trim() || "Autre";
      if (!map[key]) map[key] = { totalProfit: 0, count: 0 };
      map[key].totalProfit += venteProfitOf(v);
      map[key].count += 1;
    }
    return Object.entries(map)
      .map(([brand, s]) => ({ brand, avgProfit: s.totalProfit / s.count, count: s.count }))
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 8);
  }, [ventes]);

  const maxBrandProfit = useMemo(
    () => Math.max(...brandStats.map((b) => Math.abs(b.avgProfit)), 1),
    [brandStats]
  );

  // ── 6. Monthly growth ─────────────────────────────────────────────────────
  const growthData = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    const prevDate = new Date(thisYear, thisMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const currentProfit = ventes
      .filter((v) => {
        const d = new Date(v.date);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      })
      .reduce((acc, v) => acc + venteProfitOf(v), 0);

    const prevProfit = ventes
      .filter((v) => {
        const d = new Date(v.date);
        return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
      })
      .reduce((acc, v) => acc + venteProfitOf(v), 0);

    // determine if we have at least 2 months of data
    const months = new Set(
      ventes.map((v) => {
        const d = new Date(v.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    );
    const hasEnough = months.size >= 2;

    const change =
      prevProfit !== 0 ? ((currentProfit - prevProfit) / Math.abs(prevProfit)) * 100 : null;

    return { currentProfit, prevProfit, change, hasEnough };
  }, [ventes]);

  // ── empty state ───────────────────────────────────────────────────────────
  const isEmpty = ventes.length === 0;

  return (
    <ModalScreen
      title="Performance"
      subtitle="Analyse de tes ventes"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Enregistre tes premières ventes pour voir tes performances ici.
            </Text>
          </Card>
        ) : (
          <>
            {/* ── 1. Summary ─────────────────────────────────────────────── */}
            <SectionTitle title="Résumé" />
            <Card>
              <View style={styles.summaryRow}>
                <StatRow label="Ventes" value={String(summary.count)} />
                <View style={styles.statDivider} />
                <StatRow
                  label="Profit total"
                  value={fmtPos(summary.totalProfit)}
                  accent={summary.totalProfit >= 0 ? colors.good : colors.urgent}
                />
                <View style={styles.statDivider} />
                <StatRow
                  label="ROI"
                  value={summary.roi.toFixed(1) + "%"}
                  accent={summary.roi >= 0 ? colors.good : colors.urgent}
                />
              </View>
            </Card>

            {/* ── 2. Weekly chart ─────────────────────────────────────────── */}
            <SectionTitle title="Profit hebdomadaire" subtitle="8 dernières semaines" />
            <Card>
              <MiniBarChart
                data={weeklyChartData}
                color={colors.good}
                height={64}
              />
            </Card>

            {/* ── 3. Day of week heatmap ──────────────────────────────────── */}
            <SectionTitle title="Meilleurs jours de vente" />
            <Card>
              {dayStats.map(({ idx, count, maxCount }) => {
                const ratio = maxCount > 0 ? count / maxCount : 0;
                const isMax = count === maxCount && count > 0;
                return (
                  <View key={idx} style={styles.dayRow}>
                    <Text style={[styles.dayLabel, isMax && { color: colors.textPrimary }]}>
                      {dayLabel(idx)}
                    </Text>
                    <View style={styles.dayBarTrack}>
                      <View
                        style={[
                          styles.dayBarFill,
                          {
                            width: `${ratio * 100}%`,
                            backgroundColor: colors.good,
                            opacity: isMax ? 1 : 0.44,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.dayCount, isMax && { color: colors.good }]}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </Card>

            {/* ── 4. Price range table ────────────────────────────────────── */}
            <SectionTitle title="Tranches de prix" />
            <Card style={styles.tableCard}>
              {/* header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.tableCellLabel, styles.tableHeaderText]}>
                  Tranche
                </Text>
                <Text style={[styles.tableCell, styles.tableCellNum, styles.tableHeaderText]}>
                  Qté
                </Text>
                <Text style={[styles.tableCell, styles.tableCellNum, styles.tableHeaderText]}>
                  Délai
                </Text>
                <Text style={[styles.tableCell, styles.tableCellNum, styles.tableHeaderText]}>
                  Profit moy
                </Text>
              </View>
              {priceRangeStats.map((r, i) => (
                <View
                  key={r.label}
                  style={[styles.tableRow, i < priceRangeStats.length - 1 && styles.tableRowBorder]}
                >
                  <Text style={[styles.tableCell, styles.tableCellLabel, styles.tableCellText]}>
                    {r.label}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellNum, styles.tableCellText]}>
                    {r.count}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellNum, styles.tableCellText]}>
                    {r.count > 0 ? r.avgDelay.toFixed(0) + "j" : "—"}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.tableCellNum,
                      {
                        color:
                          r.count === 0
                            ? colors.textMuted
                            : r.avgProfit >= 0
                            ? colors.good
                            : colors.urgent,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {r.count > 0 ? fmt(r.avgProfit) : "—"}
                  </Text>
                </View>
              ))}
            </Card>

            {/* ── 5. Top brands ───────────────────────────────────────────── */}
            {brandStats.length > 0 && (
              <>
                <SectionTitle title="Top marques" subtitle="Par profit moyen" />
                <Card>
                  {brandStats.map((b, i) => {
                    const barRatio = Math.abs(b.avgProfit) / maxBrandProfit;
                    return (
                      <View key={b.brand} style={styles.brandRow}>
                        <Text style={styles.brandRank}>{i + 1}</Text>
                        <View style={styles.brandInfo}>
                          <View style={styles.brandTopRow}>
                            <Text style={styles.brandName} numberOfLines={1}>
                              {b.brand}
                            </Text>
                            <View style={styles.brandRight}>
                              <Text
                                style={[
                                  styles.brandProfit,
                                  { color: b.avgProfit >= 0 ? colors.good : colors.urgent },
                                ]}
                              >
                                {fmt(b.avgProfit)}
                              </Text>
                              <Text style={styles.brandCount}>{b.count} vte{b.count > 1 ? "s" : ""}</Text>
                            </View>
                          </View>
                          <View style={styles.brandBarTrack}>
                            <View
                              style={[
                                styles.brandBarFill,
                                {
                                  width: `${barRatio * 100}%`,
                                  backgroundColor:
                                    b.avgProfit >= 0 ? colors.good : colors.urgent,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* ── 6. Monthly growth ────────────────────────────────────────── */}
            {growthData.hasEnough && (
              <>
                <SectionTitle title="Croissance" subtitle="Ce mois vs mois précédent" />
                <Card>
                  <View style={styles.growthRow}>
                    <View style={styles.growthBlock}>
                      <Text style={styles.growthPeriodLabel}>Mois précédent</Text>
                      <Text style={styles.growthValue}>{fmtPos(growthData.prevProfit)}</Text>
                    </View>
                    <View style={styles.growthArrowWrapper}>
                      {growthData.change !== null ? (
                        <>
                          <Text
                            style={[
                              styles.growthArrow,
                              {
                                color:
                                  growthData.change >= 0 ? colors.good : colors.urgent,
                              },
                            ]}
                          >
                            {growthData.change >= 0 ? "▲" : "▼"}
                          </Text>
                          <Text
                            style={[
                              styles.growthPct,
                              {
                                color:
                                  growthData.change >= 0 ? colors.good : colors.urgent,
                              },
                            ]}
                          >
                            {Math.abs(growthData.change).toFixed(1)}%
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.growthNewLabel}>Nouveau</Text>
                      )}
                    </View>
                    <View style={[styles.growthBlock, styles.growthBlockRight]}>
                      <Text style={styles.growthPeriodLabel}>Ce mois</Text>
                      <Text
                        style={[
                          styles.growthValue,
                          {
                            color:
                              growthData.currentProfit >= growthData.prevProfit
                                ? colors.good
                                : colors.urgent,
                          },
                        ]}
                      >
                        {fmtPos(growthData.currentProfit)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </>
            )}

            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>
    </ModalScreen>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // empty
  emptyCard: {
    marginTop: 32,
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },

  // summary
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },

  // day heatmap
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  dayLabel: {
    width: 30,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  dayBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    overflow: "hidden",
  },
  dayBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  dayCount: {
    width: 24,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  // price range table
  tableCard: {
    padding: 0,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tableHeader: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  tableHeaderText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tableCell: {
    fontSize: 13,
  },
  tableCellLabel: {
    flex: 2,
  },
  tableCellNum: {
    flex: 1.5,
    textAlign: "right",
  },
  tableCellText: {
    color: colors.textSecondary,
    fontWeight: "500",
  },

  // brand ranking
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  brandRank: {
    width: 20,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
  },
  brandInfo: {
    flex: 1,
    gap: 5,
  },
  brandTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginRight: 8,
  },
  brandRight: {
    alignItems: "flex-end",
    gap: 1,
  },
  brandProfit: {
    fontSize: 13,
    fontWeight: "800",
  },
  brandCount: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "500",
  },
  brandBarTrack: {
    height: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    overflow: "hidden",
  },
  brandBarFill: {
    height: "100%",
    borderRadius: 2,
    opacity: 0.7,
  },

  // growth
  growthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  growthBlock: {
    flex: 1,
    gap: 4,
  },
  growthBlockRight: {
    alignItems: "flex-end",
  },
  growthPeriodLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  growthValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  growthArrowWrapper: {
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 2,
  },
  growthArrow: {
    fontSize: 20,
    fontWeight: "900",
  },
  growthPct: {
    fontSize: 12,
    fontWeight: "800",
  },
  growthNewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },

  bottomSpacer: {
    height: 16,
  },
});
