import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { StatCard } from "../../src/components/StatCard";
import { colors } from "../../src/theme/colors";
import { computeNiches } from "../../src/utils/logic";

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
        title="Prix moyens par marque"
        subtitle="Utilisé pour le sourcing"
      />
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
  container: { paddingHorizontal: 20, paddingBottom: 80 },
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
});
