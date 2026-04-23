import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { colors } from "../src/theme/colors";
import { useData } from "../src/store/context";
import { computeNiches } from "../src/utils/logic";

export default function NichesScreen() {
  const { ventes, niches, addNiche, updateNiche, deleteNiche } = useData();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");

  const computed = useMemo(() => computeNiches(ventes), [ventes]);
  const best = computed[0];
  const worst = computed[computed.length - 1];

  const save = () => {
    if (!name.trim() || !brand.trim()) {
      Alert.alert("Champs requis", "Nom et marque obligatoires.");
      return;
    }
    addNiche({ name: name.trim(), brand: brand.trim(), status: "test", notes: "" });
    setName("");
    setBrand("");
  };

  return (
    <ModalScreen title="Niches" subtitle="Marques et performances">
      <ScrollView contentContainerStyle={styles.content} testID="niches-scroll">
        {computed.length > 0 && (
          <View style={styles.topRow}>
            {best && (
              <Card style={styles.half} testID="niches-best">
                <Badge label="Meilleure" tone="good" />
                <Text style={styles.brand}>{best.brand.toUpperCase()}</Text>
                <Text style={styles.meta}>Score {best.score}</Text>
                <Text style={styles.meta}>
                  +{best.avgProfit}€ • {best.avgDelay}j
                </Text>
              </Card>
            )}
            {worst && worst !== best && (
              <Card style={styles.half} testID="niches-worst">
                <Badge label="Pire" tone="urgent" />
                <Text style={styles.brand}>{worst.brand.toUpperCase()}</Text>
                <Text style={styles.meta}>Score {worst.score}</Text>
                <Text style={styles.meta}>
                  {worst.avgProfit >= 0 ? "+" : ""}
                  {worst.avgProfit}€ • {worst.avgDelay}j
                </Text>
              </Card>
            )}
          </View>
        )}

        {computed.length > 0 && (
          <Card style={{ marginTop: 16 }} testID="niches-ranking">
            <Text style={styles.sectionTitle}>CLASSEMENT</Text>
            {computed.map((n, idx) => (
              <View key={n.brand} style={styles.rankRow} testID={`niche-rank-${n.brand}`}>
                <Text style={styles.rank}>#{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName}>{n.brand.toUpperCase()}</Text>
                  <Text style={styles.meta}>
                    {n.count} ventes • {Math.round(n.successRate * 100)}% gagnants
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rankScore,
                    { color: n.score >= 1 ? colors.good : colors.urgent },
                  ]}
                >
                  {n.score}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Text style={styles.sectionTitle}>MES NICHES MANUELLES</Text>
        <View style={styles.manualForm}>
          <Input label="Nom" value={name} onChangeText={setName} placeholder="Ex: Vintage Nike" testID="niche-name" />
          <Input label="Marque" value={brand} onChangeText={setBrand} placeholder="Ex: Nike" testID="niche-brand" />
          <Button label="Ajouter" onPress={save} testID="niche-add" />
        </View>

        {niches.map((n) => (
          <Card key={n.id} style={styles.manualCard} testID={`niche-${n.id}`}>
            <View style={styles.manualHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.manualName}>{n.name}</Text>
                <Text style={styles.meta}>{n.brand}</Text>
              </View>
              <Badge
                label={n.status === "test" ? "EN TEST" : "ACTIVE"}
                tone={n.status === "test" ? "warning" : "good"}
              />
            </View>
            <View style={styles.manualActions}>
              <TouchableOpacity
                onPress={() =>
                  updateNiche(n.id, {
                    status: n.status === "test" ? "active" : "test",
                  })
                }
                style={styles.chip}
                testID={`niche-toggle-${n.id}`}
              >
                <Text style={styles.chipText}>
                  {n.status === "test" ? "→ Active" : "→ En test"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteNiche(n.id)}
                style={[styles.chip, { borderColor: colors.urgentBorder }]}
                testID={`niche-delete-${n.id}`}
              >
                <Text style={[styles.chipText, { color: colors.urgent }]}>
                  Supprimer
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {computed.length === 0 && niches.length === 0 && (
          <Card>
            <Text style={styles.empty}>
              Aucune vente ni niche. Ajoute des ventes depuis le stock ou crée une niche test.
            </Text>
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  topRow: { flexDirection: "row", gap: 12 },
  half: { flex: 1, gap: 6 },
  brand: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
    letterSpacing: -0.3,
  },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rank: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
    width: 28,
  },
  rankName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  rankScore: { fontSize: 16, fontWeight: "900" },
  manualForm: { marginBottom: 16 },
  manualCard: { marginBottom: 10 },
  manualHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  manualName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  manualActions: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  empty: { color: colors.textMuted, textAlign: "center" },
});
