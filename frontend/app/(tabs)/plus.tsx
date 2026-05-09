import React, { useState, useEffect } from "react";
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
  ActivityIndicator,
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
import {
  fetchUserItems, extractUserId,
  getSavedVintedUserId, saveVintedUserId,
  getBackendUrl, saveBackendUrl, DEFAULT_BACKEND,
  type VintedItem,
} from "../../src/utils/vintedApi";
import { detectSeason } from "../../src/utils/logic";

const MENU = [
  { key: "repost-manager", path: "/repost-manager", title: "Repost Manager", desc: "File de priorité · reposts quotidiens · visibilité max", icon: "refresh-outline" as const, color: colors.good },
  { key: "performance", path: "/performance", title: "Performance", desc: "Meilleurs jours · prix · marques · croissance", icon: "bar-chart-outline" as const, color: colors.good },
  { key: "sourcing", path: "/sourcing", title: "Sourcing", desc: "Prix max · analyse marché · verdict instantané", icon: "flash-outline" as const, color: colors.info },
  { key: "niche-scanner", path: "/niche-scanner", title: "Scanner de niches", desc: "Trouve les sous-cotés à revendre", icon: "search-outline" as const, color: colors.info },
  { key: "competitors", path: "/competitors", title: "Concurrents", desc: "Surveille les autres vendeurs Vinted", icon: "eye-outline" as const, color: colors.info },
  { key: "fiscal", path: "/fiscal", title: "Simulateur fiscal", desc: "Cotisations · IR · net réel auto-entrepreneur", icon: "calculator-outline" as const, color: colors.warning },
  { key: "niches", path: "/niches", title: "Niches", desc: "Marques performantes à surveiller", icon: "layers-outline" as const, color: colors.warning },
  { key: "clients", path: "/clients", title: "Clients & templates", desc: "CRM · relances · messages pré-rédigés", icon: "people-outline" as const, color: colors.warning },
  { key: "retours", path: "/retours", title: "Retours", desc: "Suivi remboursements · pénalités marques", icon: "arrow-undo-outline" as const, color: colors.urgent },
];

// ── Vinted sync status ────────────────────────────────────────────────────────
type SyncState = "idle" | "loading" | "preview" | "done" | "error";

export default function PlusScreen() {
  const router = useRouter();
  const { stock, ventes, retours, goals, updateGoals, resetAll, reloadFromStorage, addStock } = useData();
  const [goalsOpen, setGoalsOpen] = useState(false);

  // ── Vinted sync state ──
  const [vintedInput, setVintedInput] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncItems, setSyncItems] = useState<VintedItem[]>([]);
  const [syncError, setSyncError] = useState("");
  const [syncDone, setSyncDone] = useState<{ added: number; skipped: number } | null>(null);

  // ── Backend URL config ──
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND);
  const [urlSaved, setUrlSaved] = useState(false);

  useEffect(() => {
    getSavedVintedUserId().then(setVintedInput);
    getBackendUrl().then(setBackendUrl);
  }, []);

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

  // ── Vinted sync handlers ──────────────────────────────────────────────────

  const handleFetchVinted = async () => {
    const raw = vintedInput.trim();
    if (!raw) { Alert.alert("", "Entre ton ID ou URL de profil Vinted."); return; }
    const userId = extractUserId(raw);
    if (!userId || !/^\d+$/.test(userId)) {
      Alert.alert("ID invalide", "L'ID Vinted doit être un nombre.\nEx : https://www.vinted.fr/member/12345-pseudo");
      return;
    }

    setSyncState("loading");
    setSyncError("");
    setSyncDone(null);
    try {
      const items = await fetchUserItems(userId);
      await saveVintedUserId(raw);
      if (items.length === 0) {
        setSyncState("error");
        setSyncError("Aucun article trouvé pour ce profil. Vérifie que le profil est public.");
        return;
      }
      setSyncItems(items);
      setSyncState("preview");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur réseau";
      setSyncState("error");
      setSyncError(
        msg.includes("502") || msg.includes("unreachable")
          ? "Impossible de contacter le backend. Configure l'URL ci-dessous."
          : msg.includes("404")
          ? "Utilisateur Vinted introuvable. Vérifie l'ID."
          : `Erreur : ${msg}`
      );
    }
  };

  const handleImportAll = () => {
    const existingSourceIds = new Set(stock.map((s) => s.sourceId).filter(Boolean));
    const toAdd = syncItems.filter((i) => !existingSourceIds.has(i.id));
    const skipped = syncItems.length - toAdd.length;

    toAdd.forEach((item) => {
      addStock({
        name: item.title || "Article Vinted",
        brand: item.brand || "Marque inconnue",
        category: item.category || "Autres",
        buyPrice: 0,
        sellPrice: item.price,
        views: 0,
        favorites: 0,
        daysOnline: 0,
        defect: false,
        season: detectSeason(item.category),
        repostCount: 0,
        sold: false,
        image: item.photoUrl || undefined,
        datePublication: new Date().toISOString(),
        fees: 0,
        boostCost: 0,
        sourceId: item.id,
      });
    });

    setSyncDone({ added: toAdd.length, skipped });
    setSyncState("done");
  };

  const handleSaveBackendUrl = async () => {
    await saveBackendUrl(backendUrl);
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} testID="plus-scroll">
      <ScreenHeader title="Plus" subtitle="Outils & objectifs" />

      {/* ── SYNCHRONISATION VINTED ── */}
      <SectionTitle title="Synchronisation Vinted" subtitle="Importe ton catalogue en un tap" />
      <Card style={styles.syncCard} testID="vinted-sync-card">
        <View style={styles.syncHeader}>
          <View style={[styles.menuIcon, { backgroundColor: `${colors.good}20`, borderColor: `${colors.good}50` }]}>
            <Ionicons name="sync-outline" size={22} color={colors.good} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Importer mon catalogue</Text>
            <Text style={styles.menuDesc}>Colle ton profil Vinted → stock en 10 secondes</Text>
          </View>
        </View>

        <View style={styles.syncInputRow}>
          <TextInput
            style={styles.syncInput}
            value={vintedInput}
            onChangeText={setVintedInput}
            placeholder="vinted.fr/member/12345-pseudo ou 12345"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            testID="vinted-user-input"
          />
          <TouchableOpacity
            style={[styles.syncBtn, syncState === "loading" && styles.syncBtnLoading]}
            onPress={handleFetchVinted}
            disabled={syncState === "loading"}
            testID="vinted-fetch-btn"
          >
            {syncState === "loading" ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <Ionicons name="arrow-forward" size={18} color={colors.bg} />
            )}
          </TouchableOpacity>
        </View>

        {syncState === "loading" && (
          <Text style={styles.syncLoading}>Récupération de tes annonces Vinted…</Text>
        )}

        {syncState === "error" && (
          <View style={styles.syncErrorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.urgent} />
            <Text style={styles.syncErrorText}>{syncError}</Text>
          </View>
        )}

        {syncState === "preview" && (
          <View style={styles.previewBox}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewCount}>
                {syncItems.length} article{syncItems.length > 1 ? "s" : ""} trouvés
              </Text>
              <Text style={styles.previewSub}>
                {stock.filter((s) => syncItems.some((i) => i.id === s.sourceId)).length} déjà importés
              </Text>
            </View>
            {syncItems.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.previewItem}>
                <Text style={styles.previewItemName} numberOfLines={1}>
                  {item.title || "—"}
                </Text>
                <Text style={[styles.previewItemPrice, { color: colors.good }]}>
                  {item.price.toFixed(0)} €
                </Text>
              </View>
            ))}
            {syncItems.length > 4 && (
              <Text style={styles.previewMore}>
                + {syncItems.length - 4} autre{syncItems.length - 4 > 1 ? "s" : ""}…
              </Text>
            )}
            <TouchableOpacity style={styles.importAllBtn} onPress={handleImportAll} testID="vinted-import-btn">
              <Ionicons name="download-outline" size={16} color={colors.bg} />
              <Text style={styles.importAllText}>Tout importer dans le stock</Text>
            </TouchableOpacity>
          </View>
        )}

        {syncState === "done" && syncDone && (
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>✓ Import terminé</Text>
            <Text style={styles.doneSub}>
              {syncDone.added} article{syncDone.added !== 1 ? "s" : ""} ajouté{syncDone.added !== 1 ? "s" : ""}
              {syncDone.skipped > 0 ? ` · ${syncDone.skipped} déjà en stock` : ""}
            </Text>
            <TouchableOpacity onPress={() => { setSyncState("idle"); setSyncDone(null); }}>
              <Text style={styles.doneReset}>Importer à nouveau</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* ── CONFIG BACKEND ── */}
      <TouchableOpacity onPress={() => setShowUrlConfig((v) => !v)} style={styles.urlToggle} testID="url-config-toggle">
        <Ionicons name={showUrlConfig ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
        <Text style={styles.urlToggleText}>Paramètres avancés (URL backend)</Text>
      </TouchableOpacity>
      {showUrlConfig && (
        <Card style={styles.urlCard}>
          <Text style={styles.urlLabel}>URL du backend (API Vinted proxy)</Text>
          <Text style={styles.urlHint}>
            Sur réseau local, remplace localhost par l'IP de ton ordinateur (ex : 192.168.1.42:8001)
          </Text>
          <View style={styles.urlInputRow}>
            <TextInput
              style={styles.urlInput}
              value={backendUrl}
              onChangeText={setBackendUrl}
              placeholder={DEFAULT_BACKEND}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              testID="backend-url-input"
            />
            <TouchableOpacity
              style={[styles.urlSaveBtn, urlSaved && styles.urlSaveBtnDone]}
              onPress={handleSaveBackendUrl}
              testID="backend-url-save"
            >
              <Text style={styles.urlSaveBtnText}>{urlSaved ? "✓" : "OK"}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* ── CALCULATEUR DE LOTS ── */}
      <SectionTitle title="Calculateur de lots" subtitle="Rentabilité d'un achat groupé" />
      <LotCalculator />

      {/* ── OUTILS ── */}
      <SectionTitle title="Outils" />
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

      <Text style={styles.footer}>Vinted Manager Pro · v2.1</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function LotCalculator() {
  const [lotPrice, setLotPrice] = useState("");
  const [itemCount, setItemCount] = useState("");
  const [feesPerItem, setFeesPerItem] = useState("3");
  const [targetProfit, setTargetProfit] = useState("10");
  const [calculated, setCalculated] = useState(false);

  const lot = Number(lotPrice) || 0;
  const count = Math.max(1, Number(itemCount) || 1);
  const fees = Number(feesPerItem) || 0;
  const target = Number(targetProfit) || 0;

  const costPerItem = lot / count;
  const minSellPrice = costPerItem + fees + target;
  const totalRevNeeded = minSellPrice * count;
  const breakEvenCount = lot > 0 ? Math.ceil(lot / (minSellPrice - fees)) : 0;

  const canCalculate = lot > 0 && Number(itemCount) > 0;

  return (
    <Card style={lcStyles.card} testID="lot-calculator">
      <View style={lcStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={lcStyles.label}>Prix du lot (€)</Text>
          <TextInput style={lcStyles.input} value={lotPrice} onChangeText={(v) => { setLotPrice(v); setCalculated(false); }}
            placeholder="Ex : 40" placeholderTextColor={colors.textMuted}
            keyboardType="numeric" testID="lot-price" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={lcStyles.label}>Nb d'articles</Text>
          <TextInput style={lcStyles.input} value={itemCount} onChangeText={(v) => { setItemCount(v); setCalculated(false); }}
            placeholder="Ex : 15" placeholderTextColor={colors.textMuted}
            keyboardType="numeric" testID="lot-count" />
        </View>
      </View>
      <View style={lcStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={lcStyles.label}>Frais / article (€)</Text>
          <TextInput style={lcStyles.input} value={feesPerItem} onChangeText={(v) => { setFeesPerItem(v); setCalculated(false); }}
            placeholder="3" placeholderTextColor={colors.textMuted}
            keyboardType="numeric" testID="lot-fees" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={lcStyles.label}>Profit cible / article (€)</Text>
          <TextInput style={lcStyles.input} value={targetProfit} onChangeText={(v) => { setTargetProfit(v); setCalculated(false); }}
            placeholder="10" placeholderTextColor={colors.textMuted}
            keyboardType="numeric" testID="lot-target" />
        </View>
      </View>

      <TouchableOpacity
        style={[lcStyles.calcBtn, !canCalculate && lcStyles.calcBtnDisabled]}
        onPress={() => { if (canCalculate) setCalculated(true); }}
        disabled={!canCalculate}
        testID="lot-calculate"
      >
        <Ionicons name="calculator-outline" size={16} color={canCalculate ? colors.bg : colors.textMuted} />
        <Text style={[lcStyles.calcBtnText, !canCalculate && { color: colors.textMuted }]}>Calculer</Text>
      </TouchableOpacity>

      {calculated && canCalculate && (
        <View style={lcStyles.results}>
          <View style={lcStyles.resultRow}>
            <Text style={lcStyles.resultLabel}>Coût par article</Text>
            <Text style={lcStyles.resultValue}>{costPerItem.toFixed(2)} €</Text>
          </View>
          <View style={lcStyles.resultRow}>
            <Text style={lcStyles.resultLabel}>Prix min de vente</Text>
            <Text style={[lcStyles.resultValue, { color: colors.good }]}>{minSellPrice.toFixed(0)} €</Text>
          </View>
          <View style={lcStyles.resultRow}>
            <Text style={lcStyles.resultLabel}>CA total nécessaire</Text>
            <Text style={lcStyles.resultValue}>{totalRevNeeded.toFixed(0)} €</Text>
          </View>
          <View style={[lcStyles.resultRow, lcStyles.breakEvenRow]}>
            <Text style={lcStyles.breakEvenLabel}>Seuil de rentabilité</Text>
            <Text style={[lcStyles.breakEvenValue, { color: colors.warning }]}>
              {breakEvenCount} article{breakEvenCount > 1 ? "s" : ""} vendus
            </Text>
          </View>
          <Text style={lcStyles.tip}>
            Les {count - breakEvenCount > 0 ? count - breakEvenCount : 0} article{count - breakEvenCount > 1 ? "s" : ""} restant{count - breakEvenCount > 1 ? "s" : ""} = pur profit
          </Text>
        </View>
      )}
    </Card>
  );
}

const lcStyles = StyleSheet.create({
  card: { marginBottom: 4 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 5 },
  input: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    color: colors.textPrimary, fontSize: 14, fontWeight: "700",
  },
  calcBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.good, borderRadius: 12, paddingVertical: 12, marginBottom: 4,
  },
  calcBtnDisabled: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  calcBtnText: { color: colors.bg, fontWeight: "900", fontSize: 14 },
  results: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12, marginTop: 2 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  resultLabel: { color: colors.textMuted, fontSize: 13 },
  resultValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  breakEvenRow: { borderTopWidth: 1, borderTopColor: colors.borderSoft, marginTop: 6, paddingTop: 10 },
  breakEvenLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  breakEvenValue: { fontSize: 15, fontWeight: "900" },
  tip: { color: colors.good, fontSize: 12, fontWeight: "700", marginTop: 8, textAlign: "center" },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 130 },
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

  // ── Vinted sync ──
  syncCard: { marginBottom: 4 },
  syncHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  syncInputRow: { flexDirection: "row", gap: 8 },
  syncInput: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 13,
  },
  syncBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.good,
    alignItems: "center", justifyContent: "center",
  },
  syncBtnLoading: { backgroundColor: `${colors.good}70` },
  syncLoading: { color: colors.textMuted, fontSize: 12, marginTop: 10, textAlign: "center" },
  syncErrorBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10, padding: 10, backgroundColor: colors.urgentBg, borderRadius: 10, borderWidth: 1, borderColor: colors.urgentBorder },
  syncErrorText: { color: colors.urgent, fontSize: 12, flex: 1, lineHeight: 17 },

  previewBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12 },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  previewCount: { color: colors.textPrimary, fontSize: 14, fontWeight: "900" },
  previewSub: { color: colors.textMuted, fontSize: 12 },
  previewItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  previewItemName: { color: colors.textSecondary, fontSize: 13, flex: 1, marginRight: 8 },
  previewItemPrice: { fontSize: 13, fontWeight: "800" },
  previewMore: { color: colors.textMuted, fontSize: 12, marginTop: 6, marginBottom: 4 },
  importAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.good, borderRadius: 12, padding: 12, marginTop: 12,
  },
  importAllText: { color: colors.bg, fontSize: 13, fontWeight: "800" },

  doneBox: { marginTop: 14, padding: 14, backgroundColor: colors.goodBg, borderRadius: 12, borderWidth: 1, borderColor: colors.goodBorder, alignItems: "center" },
  doneTitle: { color: colors.good, fontSize: 16, fontWeight: "900", marginBottom: 4 },
  doneSub: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
  doneReset: { color: colors.info, fontSize: 12, marginTop: 10, fontWeight: "700" },

  // ── URL config ──
  urlToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, marginBottom: 4 },
  urlToggleText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  urlCard: { marginBottom: 10 },
  urlLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  urlHint: { color: colors.textMuted, fontSize: 11, marginBottom: 10, lineHeight: 16 },
  urlInputRow: { flexDirection: "row", gap: 8 },
  urlInput: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
    color: colors.textPrimary, fontSize: 12,
  },
  urlSaveBtn: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.info, borderRadius: 10, justifyContent: "center" },
  urlSaveBtnDone: { backgroundColor: colors.good },
  urlSaveBtnText: { color: colors.bg, fontWeight: "800", fontSize: 13 },
  syncBtnText: { color: colors.bg, fontWeight: "800", fontSize: 14 },
});
