import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { colors } from "../src/theme/colors";
import { useData, Client } from "../src/store/context";

const STATUSES: { key: Client["status"]; label: string; tone: "good" | "warning" | "urgent" }[] = [
  { key: "interesse", label: "Intéressé", tone: "good" },
  { key: "negociation", label: "Négociation", tone: "warning" },
  { key: "sans_reponse", label: "Sans réponse", tone: "urgent" },
];

export default function ClientsScreen() {
  const { clients, addClient, updateClient, deleteClient } = useData();
  const [pseudo, setPseudo] = useState("");
  const [product, setProduct] = useState("");

  const save = () => {
    if (!pseudo.trim() || !product.trim()) {
      Alert.alert("Champs requis", "Pseudo et produit obligatoires.");
      return;
    }
    addClient({ pseudo: pseudo.trim(), product: product.trim(), status: "interesse" });
    setPseudo("");
    setProduct("");
  };

  const needsRelaunch = (c: Client) => {
    const diffH = (Date.now() - new Date(c.lastContact).getTime()) / 3600000;
    return c.status === "sans_reponse" && diffH >= 24;
  };

  return (
    <ModalScreen title="Clients" subtitle="CRM des acheteurs">
      <ScrollView contentContainerStyle={styles.content} testID="clients-scroll">
        <Card style={{ marginBottom: 16 }}>
          <Input label="Pseudo Vinted" value={pseudo} onChangeText={setPseudo} placeholder="@username" testID="client-pseudo" />
          <Input label="Produit" value={product} onChangeText={setProduct} placeholder="Ex: Jean Levi's 501" testID="client-product" />
          <Button label="Ajouter le client" onPress={save} testID="client-add" />
        </Card>

        {clients.length === 0 ? (
          <Card>
            <Text style={styles.empty}>Aucun client pour le moment.</Text>
          </Card>
        ) : (
          clients.map((c) => (
            <Card key={c.id} style={styles.card} testID={`client-${c.id}`}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pseudo}>@{c.pseudo}</Text>
                  <Text style={styles.product}>{c.product}</Text>
                  <Text style={styles.time}>
                    Dernière activité:{" "}
                    {new Date(c.lastContact).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                {needsRelaunch(c) && <Badge label="RELANCER" tone="warning" />}
              </View>

              <View style={styles.statusRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => updateClient(c.id, { status: s.key })}
                    style={[
                      styles.statusChip,
                      c.status === s.key && styles.statusChipActive,
                    ]}
                    testID={`client-status-${c.id}-${s.key}`}
                  >
                    <Badge label={s.label} tone={s.tone} />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => deleteClient(c.id)}
                style={styles.delete}
                testID={`client-delete-${c.id}`}
              >
                <Text style={styles.deleteText}>Supprimer</Text>
              </TouchableOpacity>
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
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  pseudo: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  product: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  time: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  statusChip: { opacity: 0.5 },
  statusChipActive: { opacity: 1 },
  delete: { alignSelf: "flex-end" },
  deleteText: {
    color: colors.urgent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  empty: { color: colors.textMuted, textAlign: "center" },
});
