import React from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { colors } from "../../src/theme/colors";
import { useData } from "../../src/store/context";
import { exportStock, exportVentes, exportRetours } from "../../src/utils/csv";
import {
  exportBackup,
  pickBackupFile,
  applyRestore,
  countPayload,
} from "../../src/utils/backup";
import { importCsvBackup } from "../../src/utils/csvImport";

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
  const { stock, ventes, retours, resetAll, reloadFromStorage } = useData();

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

  const onBackup = async () => {
    try {
      await exportBackup();
    } catch {
      Alert.alert("Erreur", "Impossible de créer la sauvegarde.");
    }
  };

  const onRestore = async () => {
    try {
      const res = await pickBackupFile();
      if (!res.ok) {
        if (res.reason === "invalid") {
          Alert.alert(
            "Fichier invalide",
            "Ce fichier n'est pas une sauvegarde Vinted Manager valide."
          );
        } else if (res.reason === "parse") {
          Alert.alert("Fichier corrompu", "Impossible de lire le fichier.");
        }
        return;
      }
      const payload = res.payload!;
      Alert.alert(
        "Restaurer la sauvegarde",
        `Sauvegarde du ${new Date(payload.exportedAt).toLocaleDateString(
          "fr-FR"
        )}\n${countPayload(payload)}\n\nQue veux-tu faire ?`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Fusionner",
            onPress: async () => {
              await applyRestore(payload, "merge");
              await reloadFromStorage();
              Alert.alert("✓ Importé", "Tes données ont été fusionnées.");
            },
          },
          {
            text: "Remplacer",
            style: "destructive",
            onPress: async () => {
              await applyRestore(payload, "replace");
              await reloadFromStorage();
              Alert.alert("✓ Restauré", "Tes données ont été remplacées.");
            },
          },
        ]
      );
    } catch {
      Alert.alert("Erreur", "Impossible de restaurer la sauvegarde.");
    }
  };

  const onImportCsv = async () => {
    try {
      const report = await importCsvBackup();
      if (report.error === "cancelled") return;
      if (report.error === "empty") {
        Alert.alert("CSV vide", "Aucune ligne lisible dans ce fichier.");
        return;
      }
      if (report.error === "parse") {
        Alert.alert("Erreur", "Impossible de lire le CSV.");
        return;
      }
      await reloadFromStorage();
      Alert.alert(
        "✓ Import terminé",
        `${report.stockAdded} article(s) + ${report.ventesAdded} vente(s) ajoutés.\n${report.ignored} ligne(s) ignorée(s) sur ${report.total}.`
      );
    } catch {
      Alert.alert("Erreur", "Impossible d'importer le CSV.");
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
      <SectionTitle
        title="Sauvegarde & Restauration"
        subtitle="Protège tes données, change de téléphone sereinement"
      />

      <TouchableOpacity onPress={onBackup} activeOpacity={0.85} testID="backup-create">
        <Card style={[styles.item, styles.backupItem]}>
          <View style={[styles.icon, { backgroundColor: `${colors.good}22`, borderColor: `${colors.good}55` }]}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.good} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Créer une sauvegarde</Text>
            <Text style={styles.desc}>
              Fichier .json complet • partage via iCloud, Drive, WhatsApp, mail…
            </Text>
          </View>
          <Ionicons name="share-outline" size={20} color={colors.textMuted} />
        </Card>
      </TouchableOpacity>

      <TouchableOpacity onPress={onRestore} activeOpacity={0.85} testID="backup-restore">
        <Card style={styles.item}>
          <View style={[styles.icon, { backgroundColor: `${colors.info}22`, borderColor: `${colors.info}55` }]}>
            <Ionicons name="cloud-download-outline" size={22} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Restaurer une sauvegarde</Text>
            <Text style={styles.desc}>
              Importer un fichier .json • fusionner ou remplacer
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Card>
      </TouchableOpacity>

      <Text style={styles.tip}>
        💡 Crée une sauvegarde avant de changer de téléphone ou de désinstaller l'app. Envoie-toi le fichier par mail pour le garder en sécurité.
      </Text>


      <SectionTitle title="Import CSV" subtitle="Historique Vinted ou fichier perso" />

      <TouchableOpacity onPress={onImportCsv} activeOpacity={0.85} testID="import-csv">
        <Card style={styles.item}>
          <View style={[styles.icon, { backgroundColor: `${colors.warning}22`, borderColor: `${colors.warning}55` }]}>
            <Ionicons name="document-text-outline" size={22} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Importer un CSV</Text>
            <Text style={styles.desc}>
              Colonnes: nom, marque, categorie, date_publication, date_vente, prix_achat, prix_vente, frais, vues, favoris
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Card>
      </TouchableOpacity>


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

      <Text style={styles.footer}>Vinted Manager • v1.2</Text>
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
  container: { paddingHorizontal: 20, paddingBottom: 100 },
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
  backupItem: {
    borderColor: colors.goodBorder,
  },
  tip: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
});
