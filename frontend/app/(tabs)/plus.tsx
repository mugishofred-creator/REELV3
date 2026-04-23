import React from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { colors } from "../../src/theme/colors";
import { useData } from "../../src/store/context";
import { exportStock, exportVentes, exportRetours } from "../../src/utils/csv";

const MENU = [
  {
    key: "sourcing",
    path: "/sourcing",
    title: "Sourcing",
    desc: "Analyse un article avant achat",
    icon: "search" as const,
    color: colors.good,
  },
  {
    key: "niches",
    path: "/niches",
    title: "Niches",
    desc: "Suivre les marques performantes",
    icon: "layers-outline" as const,
    color: colors.info,
  },
  {
    key: "clients",
    path: "/clients",
    title: "Clients",
    desc: "CRM des acheteurs intéressés",
    icon: "people-outline" as const,
    color: colors.warning,
  },
  {
    key: "retours",
    path: "/retours",
    title: "Retours",
    desc: "Suivi des remboursements",
    icon: "arrow-undo-outline" as const,
    color: colors.urgent,
  },
];

export default function PlusScreen() {
  const router = useRouter();
  const { stock, ventes, retours, resetAll } = useData();

  const confirmReset = () => {
    Alert.alert(
      "Tout effacer ?",
      "Toutes les données (stock, ventes, clients, retours, niches) seront supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Effacer", style: "destructive", onPress: resetAll },
      ]
    );
  };

  const onExport = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      Alert.alert("Erreur", "Export impossible.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      testID="plus-scroll"
    >
      <ScreenHeader title="Plus" subtitle="Outils avancés" />

      {MENU.map((m) => (
        <TouchableOpacity
          key={m.key}
          onPress={() => router.push(m.path as never)}
          activeOpacity={0.85}
          testID={`plus-${m.key}`}
        >
          <Card style={styles.item}>
            <View style={[styles.icon, { backgroundColor: `${m.color}22`, borderColor: `${m.color}55` }]}>
              <Ionicons name={m.icon} size={22} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{m.title}</Text>
              <Text style={styles.desc}>{m.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </TouchableOpacity>
      ))}

      <SectionTitle title="Export CSV" subtitle="Sauvegarde tes données" />

      <ExportRow
        label="Stock"
        hint={`${stock.length} article${stock.length > 1 ? "s" : ""}`}
        onPress={() => onExport(() => exportStock(stock))}
        testID="export-stock"
      />
      <ExportRow
        label="Ventes"
        hint={`${ventes.length} vente${ventes.length > 1 ? "s" : ""}`}
        onPress={() => onExport(() => exportVentes(ventes))}
        testID="export-ventes"
      />
      <ExportRow
        label="Retours"
        hint={`${retours.length} retour${retours.length > 1 ? "s" : ""}`}
        onPress={() => onExport(() => exportRetours(retours))}
        testID="export-retours"
      />

      <TouchableOpacity
        onPress={confirmReset}
        style={styles.reset}
        testID="plus-reset"
      >
        <Text style={styles.resetText}>Réinitialiser toutes les données</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Vinted Manager • v1.1</Text>
    </ScrollView>
  );
}

function ExportRow({
  label,
  hint,
  onPress,
  testID,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} testID={testID}>
      <Card style={styles.item}>
        <View style={[styles.icon, { backgroundColor: `${colors.good}22`, borderColor: `${colors.good}55` }]}>
          <Ionicons name="download-outline" size={22} color={colors.good} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.desc}>{hint}</Text>
        </View>
        <Ionicons name="share-outline" size={20} color={colors.textMuted} />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 80 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  desc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  reset: {
    marginTop: 24,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.urgentBorder,
    backgroundColor: colors.urgentBg,
    alignItems: "center",
  },
  resetText: {
    color: colors.urgent,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  footer: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 11,
    marginTop: 30,
  },
});
