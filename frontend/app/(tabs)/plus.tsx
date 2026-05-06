import React, { useState } from "react";
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { ProgressBar } from "../../src/components/ProgressBar";
import { colors } from "../../src/theme/colors";
import { useData } from "../../src/store/context";
import { exportStock, exportVentes, exportRetours } from "../../src/utils/csv";
import { exportBackup, pickBackupFile, applyRestore, countPayload } from "../../src/utils/backup";
import { importCsvBackup } from "../../src/utils/csvImport";
import { currentMonthStats, lastSevenDaysStats } from "../../src/utils/projections";

const MENU = [
  { key: "sourcing", path: "/sourcing", title: "Sourcing IA", desc: "Prix max · analyse marché · verdict instantané", icon: "flash-outline" as const, color: colors.good },
  { key: "niches", path: "/niches", title: "Niches", desc: "Marques performantes à surveiller", icon: "layers-outline" as const, color: colors.info },
  { key: "clients", path: "/clients", title: "Clients", desc: "CRM · relances · négociations", icon: "people-outline" as const, color: colors.warning },
  { key: "retours", path: "/retours", title: "Retours", desc: "Suivi remboursements · pénalités marques", icon: "arrow-undo-outline" as const, color: colors.urgent },
];

export default function PlusScreen() {
  const router = useRouter();
  const { stock, ventes, retours, goals, updateGoals, resetAll, reloadFromStorage } = useData();
  const [goalsOpen, setGoalsOpen] = useState(false);

  const thisMonth = currentMonthStats(ventes);
  const thisWeek = lastSevenDaysStats(ventes);

  const caProgress = goals.monthlyCAGoal > 0 ? thisMonth.revenue / goals.monthlyCAGoal : 0;
  const profitProgress = goals.monthlyProfitGoal > 0 ? thisMonth.profit / goals.monthlyProfitGoal : 0;
  const weekProgress = goals.weeklyItemsGoal > 0 ? thisWeek.count / goals.weeklyItemsGoal : 0;
  const delayOK = goals.avgDelayGoal > 0
    ? ventes.length > 0
      ? (ventes.reduce((s, v) => s + (v.delay || 0), 0) / ventes.length) <= goals.avgDelayGoal
      : true
    : true;

  const confirmReset = () =>
    Alert.alert("Tout effacer ?", "Toutes les données seront supprimées.", [
      { text: "Annuler", style: "cancel" },
      { text: "Effacer", style: "destructive", onPress: resetAll },
    ]);

  const onExport = async (fn: () => Promise<void>) => {
    try { await fn(); } catch { Alert.alert("Erreur", "Export impossible."); }
  };

  const onBackup = async () => {
    try { await exportBackup(); } catch { Alert.alert("Erreur", "Impossible de créer la sauvegarde."); }
  };

  const onRestore = async () => {
    try {
      const res = await pickBackupFile();
      if (!res.ok) {
        Alert.alert(res.reason === "invalid" ? "Fichier invalide" : "Fichier corrompu", "Ce fichier n'est pas reconnu.");
        return;
      }
      const payload = res.payload!;
      Alert.alert(
        "Restaurer",
        `Sauvegarde du ${new Date(payload.exportedAt).toLocaleDateString("fr-FR")}\n${countPayload(payload)}\n\nQue veux-tu faire ?`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Fusionner", onPress: async () => { await applyRestore(payload, "merge"); await reloadFromStorage(); Alert.alert("✓ Importé", "Données fusionnées."); } },
          { text: "Remplacer", style: "destructive", onPress: async () => { await applyRestore(payload, "replace"); await reloadFromStorage(); Alert.alert("✓ Restauré", "Données remplacées."); } },
        ]
      );
    } catch { Alert.alert("Erreur", "Impossible de restaurer."); }
  };

  const onImportCsv = async () => {
    try {
      const report = await importCsvBackup();
      if (report.error === "cancelled") return;
      if (report.error === "empty") { Alert.alert("CSV vide", "Aucune ligne lisible."); return; }
      if (report.error === "parse") { Alert.alert("Erreur", "Impossible de lire le CSV."); return; }
      await reloadFromStorage();
      Alert.alert("✓ Import terminé", `${report.stockAdded} article(s) + ${report.ventesAdded} vente(s) ajoutés.`);
    } catch { Alert.alert("Erreur", "Impossible d'importer."); }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} testID="plus-scroll">
      <ScreenHeader title="Plus" subtitle="Outils & objectifs" />

      {/* ── OUTILS ── */}
      {MENU.map((m) => (
        <TouchableOpacity key={m.key} onPress={() => router.push(m.path as never)} activeOpacity={0.85} testID={`plus-${m.key}`}>
          <Card style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: `${m.color}20`, borderColor: `${m.color}50` }]}>
              <Ionicons name={m.icon} size={22} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>{m.title}</Text>
              <Text style={styles.menuDesc}>{m.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </TouchableOpacity>
      ))}

      {/* ── OBJECTIFS ── */}
      <SectionTitle title="Objectifs" subtitle="Tes cibles mensuelles" />
      <Card>
        <TouchableOpacity onPress={() => setGoalsOpen((v) => !v)} style={styles.goalsToggle}>
          <Text style={styles.goalsToggleText}>
            {goalsOpen ? "▲ Masquer les objectifs" : "▼ Modifier les objectifs"}
          </Text>
        </TouchableOpacity>

        {goalsOpen && (
          <View style={styles.goalsInputs}>
            <GoalInput label="CA mensuel cible (€)" value={String(goals.monthlyCAGoal)} onSave={(v) => updateGoals({ monthlyCAGoal: Number(v) || 0 })} />
            <GoalInput label="Profit mensuel cible (€)" value={String(goals.monthlyProfitGoal)} onSave={(v) => updateGoals({ monthlyProfitGoal: Number(v) || 0 })} />
            <GoalInput label="Délai max cible (jours)" value={String(goals.avgDelayGoal)} onSave={(v) => updateGoals({ avgDelayGoal: Number(v) || 0 })} />
            <GoalInput label="Ventes / semaine cible" value={String(goals.weeklyItemsGoal)} onSave={(v) => updateGoals({ weeklyItemsGoal: Number(v) || 0 })} />
          </View>
        )}

        <View style={styles.separator} />

        <ProgressBar
          progress={caProgress}
          color={caProgress >= 1 ? colors.good : colors.warning}
          label="CA ce mois"
          valueLabel={`${thisMonth.revenue.toFixed(0)} / ${goals.monthlyCAGoal} €`}
          height={8}
        />
        <View style={{ height: 12 }} />
        <ProgressBar
          progress={profitProgress}
          color={profitProgress >= 1 ? colors.good : colors.info}
          label="Profit ce mois"
          valueLabel={`${thisMonth.profit.toFixed(0)} / ${goals.monthlyProfitGoal} €`}
          height={8}
        />
        <View style={{ height: 12 }} />
        <ProgressBar
          progress={weekProgress}
          color={weekProgress >= 1 ? colors.good : colors.warning}
          label="Ventes cette semaine"
          valueLabel={`${thisWeek.count} / ${goals.weeklyItemsGoal}`}
          height={8}
        />
        <View style={{ height: 12 }} />
        <View style={styles.delayRow}>
          <Text style={styles.delayLabel}>Délai moyen vs objectif</Text>
          <Text style={[styles.delayValue, { color: delayOK ? colors.good : colors.urgent }]}>
            {ventes.length > 0
              ? `${(ventes.reduce((s, v) => s + (v.delay || 0), 0) / ventes.length).toFixed(1)}j`
              : "—"}
            {" "}/ {goals.avgDelayGoal}j
            {delayOK ? "  ✓" : "  ✕"}
          </Text>
        </View>
      </Card>

      {/* ── SAUVEGARDE ── */}
      <SectionTitle title="Sauvegarde" subtitle="Protège tes données" />
      <TouchableOpacity onPress={onBackup} activeOpacity={0.85} testID="backup-create">
        <Card style={[styles.menuItem, { borderColor: colors.goodBorder }]}>
          <View style={[styles.menuIcon, { backgroundColor: colors.goodBg, borderColor: colors.goodBorder }]}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.good} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Créer une sauvegarde</Text>
            <Text style={styles.menuDesc}>Fichier .json · partage via Drive, mail, WhatsApp…</Text>
          </View>
          <Ionicons name="share-outline" size={18} color={colors.textMuted} />
        </Card>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRestore} activeOpacity={0.85} testID="backup-restore">
        <Card style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: colors.infoBg, borderColor: colors.infoBorder }]}>
            <Ionicons name="cloud-download-outline" size={22} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Restaurer une sauvegarde</Text>
            <Text style={styles.menuDesc}>Importer un fichier .json · fusionner ou remplacer</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      </TouchableOpacity>

      {/* ── IMPORT CSV ── */}
      <SectionTitle title="Import CSV" subtitle="Historique Vinted ou fichier perso" />
      <TouchableOpacity onPress={onImportCsv} activeOpacity={0.85} testID="import-csv">
        <Card style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
            <Ionicons name="document-text-outline" size={22} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Importer un CSV</Text>
            <Text style={styles.menuDesc}>nom, marque, prix_achat, prix_vente, frais, vues…</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      </TouchableOpacity>

      {/* ── EXPORT CSV ── */}
      <SectionTitle title="Export CSV" />
      <ExportRow label="Stock" hint={`${stock.length} article${stock.length > 1 ? "s" : ""}`} onPress={() => onExport(() => exportStock(stock))} testID="export-stock" />
      <ExportRow label="Ventes" hint={`${ventes.length} vente${ventes.length > 1 ? "s" : ""}`} onPress={() => onExport(() => exportVentes(ventes))} testID="export-ventes" />
      <ExportRow label="Retours" hint={`${retours.length} retour${retours.length > 1 ? "s" : ""}`} onPress={() => onExport(() => exportRetours(retours))} testID="export-retours" />

      {/* ── RESET ── */}
      <TouchableOpacity onPress={confirmReset} style={styles.resetBtn} testID="plus-reset">
        <Text style={styles.resetText}>Réinitialiser toutes les données</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Vinted Manager Pro · v2.0</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function GoalInput({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  return (
    <View style={giStyles.row}>
      <Text style={giStyles.label}>{label}</Text>
      <TextInput
        style={giStyles.input}
        value={local}
        onChangeText={setLocal}
        onBlur={() => onSave(local)}
        keyboardType="numeric"
        returnKeyType="done"
        onSubmitEditing={() => onSave(local)}
      />
    </View>
  );
}

const giStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  label: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  input: { color: colors.textPrimary, fontSize: 15, fontWeight: "800", textAlign: "right", minWidth: 70, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surfaceElevated, borderRadius: 8 },
});

function ExportRow({ label, hint, onPress, testID }: { label: string; hint: string; onPress: () => void; testID: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} testID={testID}>
      <Card style={styles.menuItem}>
        <View style={[styles.menuIcon, { backgroundColor: colors.goodBg, borderColor: colors.goodBorder }]}>
          <Ionicons name="download-outline" size={22} color={colors.good} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>{label}</Text>
          <Text style={styles.menuDesc}>{hint}</Text>
        </View>
        <Ionicons name="share-outline" size={18} color={colors.textMuted} />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 100 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  menuIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  menuTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  menuDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  goalsToggle: { paddingVertical: 4, marginBottom: 14 },
  goalsToggleText: { color: colors.info, fontSize: 13, fontWeight: "700" },
  goalsInputs: { marginBottom: 16 },
  separator: { height: 1, backgroundColor: colors.borderSoft, marginBottom: 16 },
  delayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  delayLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  delayValue: { fontSize: 13, fontWeight: "800" },
  resetBtn: { marginTop: 24, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.urgentBorder, backgroundColor: colors.urgentBg, alignItems: "center" },
  resetText: { color: colors.urgent, fontWeight: "800", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  footer: { color: colors.textMuted, textAlign: "center", fontSize: 11, marginTop: 24 },
});
