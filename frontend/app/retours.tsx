import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { colors } from "../src/theme/colors";
import { useData, Retour } from "../src/store/context";

const REASONS: Retour["reason"][] = [
  "mauvaise taille",
  "défaut non mentionné",
  "non conforme",
  "changement d'avis",
];

export default function RetoursScreen() {
  const { retours, addRetour, deleteRetour } = useData();
  const [product, setProduct] = useState("");
  const [brand, setBrand] = useState("");
  const [refund, setRefund] = useState("");
  const [reason, setReason] = useState<Retour["reason"]>("mauvaise taille");

  const save = () => {
    if (!product.trim() || !brand.trim()) {
      Alert.alert("Champs requis", "Produit et marque obligatoires.");
      return;
    }
    addRetour({
      product: product.trim(),
      brand: brand.trim(),
      reason,
      refund: Number(refund) || 0,
    });
    setProduct("");
    setBrand("");
    setRefund("");
  };

  const totalRefund = retours.reduce((s, r) => s + (r.refund || 0), 0);

  return (
    <ModalScreen title="Retours" subtitle={`${retours.length} retours • ${totalRefund.toFixed(0)}€ remboursés`}>
      <ScrollView contentContainerStyle={styles.content} testID="retours-scroll">
        <Card style={{ marginBottom: 16 }}>
          <Input label="Produit" value={product} onChangeText={setProduct} placeholder="Ex: Pull Nike" testID="retour-product" />
          <Input label="Marque" value={brand} onChangeText={setBrand} placeholder="Ex: Nike" testID="retour-brand" />
          <Input
            label="Remboursement (€)"
            value={refund}
            onChangeText={setRefund}
            keyboardType="numeric"
            placeholder="0"
            testID="retour-refund"
          />

          <Text style={styles.label}>RAISON</Text>
          <View style={styles.reasonRow}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setReason(r)}
                style={[
                  styles.reasonChip,
                  reason === r && styles.reasonChipActive,
                ]}
                testID={`retour-reason-${r}`}
              >
                <Text
                  style={[
                    styles.reasonText,
                    reason === r && { color: colors.good },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button label="Enregistrer le retour" onPress={save} testID="retour-add" />
        </Card>

        {retours.length === 0 ? (
          <Card>
            <Text style={styles.empty}>Aucun retour enregistré.</Text>
          </Card>
        ) : (
          retours.map((r) => (
            <Card key={r.id} style={styles.card} testID={`retour-${r.id}`}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.product}>{r.product}</Text>
                  <Text style={styles.meta}>
                    {r.brand} • {new Date(r.date).toLocaleDateString("fr-FR")}
                  </Text>
                </View>
                <Text style={styles.refund}>-{r.refund.toFixed(0)}€</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Badge label={r.reason} tone="urgent" />
                <TouchableOpacity
                  onPress={() => deleteRetour(r.id)}
                  testID={`retour-delete-${r.id}`}
                >
                  <Text style={styles.deleteText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  card: { marginBottom: 10 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  reasonChipActive: {
    borderColor: colors.good,
    backgroundColor: colors.goodBg,
  },
  reasonText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  product: { color: colors.textPrimary, fontSize: 15, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  refund: { color: colors.urgent, fontSize: 16, fontWeight: "900" },
  deleteText: {
    color: colors.urgent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  empty: { color: colors.textMuted, textAlign: "center" },
});
