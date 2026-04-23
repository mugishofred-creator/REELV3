import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { colors } from "../src/theme/colors";
import { useData } from "../src/store/context";
import { sourcingRecommendation, SourcingVerdict } from "../src/utils/logic";

const verdictTone = (v: SourcingVerdict) =>
  v === "ACHAT FORT" ? "good" : v === "ACHETER" ? "info" : v === "NÉGOCIER" ? "warning" : "urgent";

export default function Sourcing() {
  const { ventes } = useData();
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    if (!submitted) return null;
    return sourcingRecommendation(
      brand.trim(),
      category.trim(),
      Number(buyPrice) || 0,
      ventes
    );
  }, [submitted, brand, category, buyPrice, ventes]);

  return (
    <ModalScreen title="Sourcing" subtitle="Dois-je acheter cet article ?">
      <ScrollView contentContainerStyle={styles.content} testID="sourcing-scroll">
        <Input
          label="Marque"
          value={brand}
          onChangeText={(v) => {
            setBrand(v);
            setSubmitted(false);
          }}
          placeholder="Ex: Nike"
          testID="sourcing-brand"
        />
        <Input
          label="Catégorie"
          value={category}
          onChangeText={(v) => {
            setCategory(v);
            setSubmitted(false);
          }}
          placeholder="Ex: hoodie"
          testID="sourcing-category"
        />
        <Input
          label="Prix achat (€)"
          value={buyPrice}
          onChangeText={(v) => {
            setBuyPrice(v);
            setSubmitted(false);
          }}
          keyboardType="numeric"
          placeholder="0"
          testID="sourcing-price"
        />

        <Button
          label="Analyser"
          onPress={() => setSubmitted(true)}
          disabled={!brand || !buyPrice}
          testID="sourcing-analyze"
        />

        {result && (
          <Card style={styles.result} testID="sourcing-result">
            <Badge label={result.verdict} tone={verdictTone(result.verdict)} />
            <Text style={styles.verdictText}>
              {result.verdict === "ACHAT FORT" &&
                "💎 Grosse opportunité. Achète tout de suite."}
              {result.verdict === "ACHETER" &&
                "✅ Bon ratio, achat recommandé."}
              {result.verdict === "NÉGOCIER" &&
                "⚠ Marge faible — négocie le prix."}
              {result.verdict === "IGNORE" &&
                "✗ Rentabilité insuffisante. Passe."}
            </Text>

            <View style={styles.stats}>
              <Row
                label="Prix vente moyen"
                value={
                  result.avgSell > 0
                    ? `${result.avgSell.toFixed(0)} €`
                    : "Aucune donnée"
                }
              />
              <Row
                label="Délai moyen"
                value={
                  result.avgDelay > 0 ? `${result.avgDelay.toFixed(0)} j` : "—"
                }
              />
              <Row
                label="Profit estimé"
                value={`${result.profit.toFixed(0)} €`}
                tone={result.profit > 5 ? "good" : "urgent"}
              />
              <Row
                label="Ratio achat/vente"
                value={
                  result.avgSell > 0
                    ? `${Math.round(result.ratio * 100)}%`
                    : "—"
                }
                tone={result.ratio < 0.5 ? "good" : "warning"}
              />
            </View>
          </Card>
        )}

        <Text style={styles.hint}>
          Conseil : enregistre tes ventes pour que le sourcing devienne plus précis. Sans historique, l'app te recommande de négocier par défaut.
        </Text>
      </ScrollView>
    </ModalScreen>
  );
}

function Row({
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
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: col }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  result: { marginTop: 20, gap: 10 },
  verdictText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    lineHeight: 22,
  },
  stats: { marginTop: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { fontSize: 14, fontWeight: "800" },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 20,
    lineHeight: 18,
  },
});
