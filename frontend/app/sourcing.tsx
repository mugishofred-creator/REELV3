import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { colors } from "../src/theme/colors";
import { useData } from "../src/store/context";
import { sourcingAnalyze, Sourcing as SourcingVerdict } from "../src/utils/analytics";

const verdictTone = (v: SourcingVerdict) =>
  v === "ACHETER"
    ? "good"
    : v === "OK"
    ? "info"
    : v === "NEGOCIER"
    ? "warning"
    : v === "REFUSER"
    ? "urgent"
    : "neutral";

const verdictLabel = (v: SourcingVerdict) => {
  switch (v) {
    case "ACHETER":
      return "🟢 ACHETER";
    case "OK":
      return "🟢 OK";
    case "NEGOCIER":
      return "🟡 NÉGOCIER";
    case "REFUSER":
      return "🔴 REFUSER";
    case "DONNEES_INSUFFISANTES":
      return "⚪ DONNÉES INSUFFISANTES";
  }
};

export default function Sourcing() {
  const { ventes } = useData();
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [fees, setFees] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    if (!submitted) return null;
    return sourcingAnalyze(
      brand.trim(),
      category.trim(),
      Number(buyPrice) || 0,
      ventes,
      Number(fees) || 0
    );
  }, [submitted, brand, category, buyPrice, fees, ventes]);

  return (
    <ModalScreen title="Sourcing" subtitle="Dois-je acheter ?">
      <ScrollView contentContainerStyle={styles.content} testID="sourcing-scroll">
        <Input
          label="Marque"
          value={brand}
          onChangeText={(v) => {
            setBrand(v);
            setSubmitted(false);
          }}
          placeholder="Ex: Carhartt"
          testID="sourcing-brand"
        />
        <Input
          label="Catégorie"
          value={category}
          onChangeText={(v) => {
            setCategory(v);
            setSubmitted(false);
          }}
          placeholder="Ex: cargo, workwear…"
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
        <Input
          label="Frais estimés (€) — optionnel"
          value={fees}
          onChangeText={(v) => {
            setFees(v);
            setSubmitted(false);
          }}
          keyboardType="numeric"
          placeholder="0"
          testID="sourcing-fees"
        />

        <Button
          label="Analyser"
          onPress={() => setSubmitted(true)}
          disabled={!brand || !buyPrice}
          testID="sourcing-analyze"
        />

        {result && (
          <Card style={styles.result} testID="sourcing-result">
            <Badge label={verdictLabel(result.verdict)} tone={verdictTone(result.verdict)} />
            <Text style={styles.verdictText}>{result.reason}</Text>

            <View style={styles.stats}>
              <Row
                label="Échantillon"
                value={`${result.sampleSize} vente${result.sampleSize > 1 ? "s" : ""}`}
                tone={
                  result.sampleSize === 0
                    ? "urgent"
                    : result.sampleSize < 3
                    ? "warning"
                    : "good"
                }
              />
              <Row
                label="Prix moyen marque"
                value={result.avgSell > 0 ? `${result.avgSell.toFixed(0)} €` : "—"}
              />
              <Row
                label="Profit estimé"
                value={
                  result.profit === null ? "—" : `${result.profit.toFixed(0)} €`
                }
                tone={
                  result.profit === null
                    ? "neutral"
                    : result.profit > 10
                    ? "good"
                    : result.profit >= 0
                    ? "warning"
                    : "urgent"
                }
              />
              <Row
                label="Score sourcing"
                value={`${result.score} / 100`}
                tone={
                  result.score >= 70 ? "good" : result.score >= 40 ? "warning" : "urgent"
                }
              />
              <Row
                label="Bonus catégorie"
                value={
                  result.categoryBonus > 30
                    ? "Catégorie forte (+40)"
                    : result.categoryBonus < 0
                    ? "Catégorie faible (−10)"
                    : "Neutre"
                }
                tone={
                  result.categoryBonus > 30
                    ? "good"
                    : result.categoryBonus < 0
                    ? "urgent"
                    : "neutral"
                }
              />
            </View>
          </Card>
        )}

        <Text style={styles.hint}>
          Règle : rotation &gt; marge. Si marge &lt; 5€ → négocie. Si marge &lt; 0 → refuse. Catégories fortes : Carhartt, Dickies, workwear, Levi's, Patagonia.
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
  tone?: "good" | "urgent" | "warning" | "neutral";
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
  content: { padding: 20, paddingBottom: 60 },
  result: { marginTop: 20, gap: 10 },
  verdictText: {
    color: colors.textPrimary,
    fontSize: 15,
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
