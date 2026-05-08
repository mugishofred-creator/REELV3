import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ScrollView, View, Text, StyleSheet, TextInput,
  TouchableOpacity, AppState, AppStateStatus, Image,
  ActivityIndicator, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { colors, shadow } from "../../src/theme/colors";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import {
  SniperRule, SniperHit,
  loadRules, saveRules, addRule, deleteRule, toggleRule,
  loadHits, clearHits, runSniperCheck, initSeenIds,
} from "../../src/utils/sniper";

// ── Background task ───────────────────────────────────────────────────────────

const BG_TASK = "SNIPER_BG";

TaskManager.defineTask(BG_TASK, async () => {
  try {
    const rules = await loadRules();
    await initSeenIds();
    await runSniperCheck(rules);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function registerBgTask() {
  try {
    await BackgroundFetch.registerTaskAsync(BG_TASK, {
      minimumInterval: 15 * 60, // Android may run more frequently in practice
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // already registered or unavailable
  }
}

// ── Foreground poll interval (30s — anonyme, pas de risque de ban) ───────────
const FOREGROUND_INTERVAL_MS = 30_000;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SniperScreen() {
  const [rules, setRules] = useState<SniperRule[]>([]);
  const [hits, setHits] = useState<SniperHit[]>([]);
  const [active, setActive] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [lastCheckOk, setLastCheckOk] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState(0);

  // New rule form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formMaxPrice, setFormMaxPrice] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  // ── Load data + notification tap handler ──────────────────────────────────

  useEffect(() => {
    (async () => {
      const [r, h] = await Promise.all([loadRules(), loadHits()]);
      setRules(r);
      setHits(h);
      await registerBgTask();
      await Notifications.requestPermissionsAsync();
    })();

    // Quand l'utilisateur tape la notification → ouvre directement l'app Vinted
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) Linking.openURL(url).catch(() => null);
    });
    return () => sub.remove();
  }, []);

  // ── Foreground polling ─────────────────────────────────────────────────────

  const doCheck = useCallback(async (rulesOverride?: SniperRule[]) => {
    const currentRules = rulesOverride ?? rules;
    const enabledCount = currentRules.filter((r) => r.enabled).length;
    if (enabledCount === 0) return;

    setChecking(true);
    let ok = false;
    try {
      const newHits = await runSniperCheck(currentRules);
      ok = true;
      if (newHits.length > 0) {
        setHits((prev) => [...newHits, ...prev].slice(0, 100));
      }
      const updatedRules = await loadRules();
      setRules(updatedRules);
    } catch {
      // network error — don't update lastCheck so user knows it failed
    } finally {
      setChecking(false);
      if (ok) setLastCheck(new Date());
      setLastCheckOk(ok);
      setCountdown(FOREGROUND_INTERVAL_MS / 1000);
    }
  }, [rules]);

  const startPolling = useCallback((rulesOverride?: SniperRule[]) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    doCheck(rulesOverride);

    intervalRef.current = setInterval(() => {
      doCheck(rulesOverride);
    }, FOREGROUND_INTERVAL_MS);

    setCountdown(FOREGROUND_INTERVAL_MS / 1000);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : FOREGROUND_INTERVAL_MS / 1000));
    }, 1000);
  }, [doCheck]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setCountdown(0);
  }, []);

  useEffect(() => {
    if (active) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [active]);

  // Pause when app goes to background (background task takes over)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current === "active" && next.match(/inactive|background/)) {
        stopPolling();
      } else if (appState.current.match(/inactive|background/) && next === "active") {
        if (active) startPolling();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [active, startPolling, stopPolling]);

  // ── Rule actions ───────────────────────────────────────────────────────────

  const handleAddRule = async () => {
    const maxPrice = parseFloat(formMaxPrice);
    if (!formKeywords.trim() || isNaN(maxPrice) || maxPrice <= 0) return;
    const updated = await addRule({
      name: formName.trim() || formKeywords.trim(),
      keywords: formKeywords.trim(),
      maxPrice,
      enabled: true,
    });
    setRules(updated);
    setFormName("");
    setFormKeywords("");
    setFormMaxPrice("");
    setShowForm(false);

    if (active) startPolling(updated);
  };

  const handleToggle = async (id: string) => {
    const updated = await toggleRule(id);
    setRules(updated);
    if (active) startPolling(updated);
  };

  const handleDelete = async (id: string) => {
    const updated = await deleteRule(id);
    setRules(updated);
  };

  const handleClearHits = async () => {
    await clearHits();
    setHits([]);
  };

  const activeRulesCount = rules.filter((r) => r.enabled).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      testID="sniper-scroll"
    >
      <ScreenHeader
        title="Sniper"
        subtitle="Détecte les erreurs de prix en temps réel"
      />

      {/* ── STATUS CARD ── */}
      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.dot, active ? styles.dotActive : styles.dotIdle]} />
            <View>
              <Text style={styles.statusLabel}>
                {active ? "SNIPER ACTIF" : "SNIPER INACTIF"}
              </Text>
              <Text style={styles.statusSub}>
                {active
                  ? checking
                    ? "Analyse en cours…"
                    : countdown > 0
                    ? `Prochaine analyse dans ${countdown}s`
                    : "En attente…"
                  : activeRulesCount > 0
                  ? `${activeRulesCount} règle${activeRulesCount > 1 ? "s" : ""} prête${activeRulesCount > 1 ? "s" : ""}`
                  : "Aucune règle active"}
              </Text>
              {lastCheck && lastCheckOk && (
                <Text style={styles.statusTime}>
                  ✓ Vérif OK : {lastCheck.toLocaleTimeString("fr-FR")}
                </Text>
              )}
              {lastCheckOk === false && (
                <Text style={[styles.statusTime, { color: colors.urgent }]}>
                  ✗ Pas de réseau — en attente…
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.toggleBtn, active ? styles.toggleBtnOn : styles.toggleBtnOff]}
            onPress={() => setActive((v) => !v)}
            disabled={activeRulesCount === 0 && !active}
          >
            {checking ? (
              <ActivityIndicator size="small" color={active ? "#000" : colors.good} />
            ) : (
              <Ionicons
                name={active ? "pause" : "play"}
                size={20}
                color={active ? "#000" : colors.good}
              />
            )}
          </TouchableOpacity>
        </View>

        {active && (
          <View style={styles.speedBadge}>
            <Ionicons name="flash" size={10} color={colors.good} />
            <Text style={styles.speedText}>Scan toutes les 15s · Android optimisé</Text>
          </View>
        )}
      </Card>

      {/* ── RÈGLES ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Règles de chasse</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Ionicons name={showForm ? "close" : "add"} size={16} color={colors.good} />
          <Text style={styles.addBtnText}>{showForm ? "Annuler" : "Ajouter"}</Text>
        </TouchableOpacity>
      </View>

      {/* ── FORMULAIRE NOUVELLE RÈGLE ── */}
      {showForm && (
        <Card style={styles.formCard} accent="good">
          <Text style={styles.formTitle}>Nouvelle règle</Text>

          <Text style={styles.inputLabel}>Nom (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: Carhartt pas cher"
            placeholderTextColor={colors.textMuted}
            value={formName}
            onChangeText={setFormName}
          />

          <Text style={styles.inputLabel}>Mots-clés Vinted *</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: carhartt veste"
            placeholderTextColor={colors.textMuted}
            value={formKeywords}
            onChangeText={setFormKeywords}
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Prix max (€) *</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 15"
            placeholderTextColor={colors.textMuted}
            value={formMaxPrice}
            onChangeText={setFormMaxPrice}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!formKeywords.trim() || !formMaxPrice) && styles.saveBtnDisabled,
            ]}
            onPress={handleAddRule}
            disabled={!formKeywords.trim() || !formMaxPrice}
          >
            <Ionicons name="checkmark" size={16} color="#000" />
            <Text style={styles.saveBtnText}>Créer la règle</Text>
          </TouchableOpacity>
        </Card>
      )}

      {rules.length === 0 && !showForm ? (
        <Card testID="sniper-empty">
          <Text style={styles.emptyText}>Aucune règle.</Text>
          <Text style={styles.emptyHint}>
            Crée une règle pour surveiller des articles sous un prix cible.
          </Text>
        </Card>
      ) : (
        rules.map((rule) => (
          <Card key={rule.id} style={styles.ruleCard}>
            <View style={styles.ruleRow}>
              <View style={styles.ruleLeft}>
                <View style={styles.ruleNameRow}>
                  <Text style={styles.ruleName}>{rule.name}</Text>
                  {rule.hitsCount > 0 && (
                    <View style={styles.hitsBadge}>
                      <Text style={styles.hitsCount}>{rule.hitsCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.ruleKeywords}>🔍 {rule.keywords}</Text>
                <Text style={styles.rulePrice}>Prix max : {rule.maxPrice}€</Text>
              </View>

              <View style={styles.ruleActions}>
                <TouchableOpacity
                  style={[styles.ruleToggle, rule.enabled ? styles.ruleToggleOn : styles.ruleToggleOff]}
                  onPress={() => handleToggle(rule.id)}
                >
                  <Text style={[styles.ruleToggleText, rule.enabled && styles.ruleToggleTextOn]}>
                    {rule.enabled ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(rule.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))
      )}

      {/* ── DEALS DÉTECTÉS ── */}
      {hits.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Deals détectés</Text>
            <TouchableOpacity onPress={handleClearHits}>
              <Text style={styles.clearText}>Vider</Text>
            </TouchableOpacity>
          </View>
          {hits.map((hit) => (
            <TouchableOpacity
              key={`${hit.id}-${hit.detectedAt}`}
              onPress={() => Linking.openURL(hit.vintedUrl).catch(() => null)}
              activeOpacity={0.75}
            >
              <Card style={styles.hitCard} accent="good">
                <View style={styles.hitRow}>
                  {hit.photo ? (
                    <Image source={{ uri: hit.photo }} style={styles.hitPhoto} />
                  ) : (
                    <View style={[styles.hitPhoto, styles.hitPhotoPlaceholder]}>
                      <Ionicons name="shirt-outline" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hitTitle} numberOfLines={2}>{hit.title}</Text>
                    {hit.brand ? <Text style={styles.hitBrand}>{hit.brand}</Text> : null}
                    <Text style={styles.hitMeta}>
                      Règle: {hit.ruleName} · {new Date(hit.detectedAt).toLocaleTimeString("fr-FR")}
                    </Text>
                  </View>
                  <View style={styles.hitPriceWrap}>
                    <Text style={styles.hitPrice}>{hit.price}€</Text>
                    <Text style={styles.hitOpen}>OUVRIR →</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* ── TIPS ── */}
      <Card style={styles.tipsCard}>
        <View style={styles.tipRow}>
          <Ionicons name="flash" size={14} color={colors.good} />
          <Text style={styles.tipText}>Scan toutes les 15s quand l'écran est ouvert</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="moon" size={14} color={colors.info} />
          <Text style={styles.tipText}>Scan en arrière-plan automatique (Android)</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="notifications" size={14} color={colors.warning} />
          <Text style={styles.tipText}>Notification MAX priorité à chaque deal détecté</Text>
        </View>
        <View style={styles.tipRow}>
          <Ionicons name="eye-off" size={14} color={colors.textMuted} />
          <Text style={styles.tipText}>IDs déjà vus ignorés — zéro doublon, zéro spam</Text>
        </View>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 130 },

  statusCard: { marginBottom: 16 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotActive: {
    backgroundColor: colors.good,
    shadowColor: colors.good,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  dotIdle: { backgroundColor: colors.textMuted },
  statusLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  statusSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  statusTime: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  toggleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnOn: {
    backgroundColor: colors.good,
    borderColor: colors.good,
    ...shadow.glow,
  },
  toggleBtnOff: {
    backgroundColor: "transparent",
    borderColor: colors.good,
  },

  speedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  speedText: { color: colors.good, fontSize: 11, fontWeight: "700" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addBtnText: { color: colors.good, fontSize: 13, fontWeight: "800" },

  formCard: { marginBottom: 12 },
  formTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", marginBottom: 12 },
  inputLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 12,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.good,
    borderRadius: 12,
    paddingVertical: 12,
    ...shadow.glow,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: "#000", fontWeight: "900", fontSize: 14 },

  ruleCard: { marginBottom: 10 },
  ruleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  ruleLeft: { flex: 1 },
  ruleNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  ruleName: { color: colors.textPrimary, fontSize: 14, fontWeight: "900" },
  hitsBadge: {
    backgroundColor: colors.good,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hitsCount: { color: "#000", fontSize: 10, fontWeight: "900" },
  ruleKeywords: { color: colors.textMuted, fontSize: 12, marginBottom: 2 },
  rulePrice: { color: colors.info, fontSize: 12, fontWeight: "700" },
  ruleActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleToggleOn: { backgroundColor: colors.goodGlow, borderColor: colors.good },
  ruleToggleOff: { backgroundColor: "transparent" },
  ruleToggleText: { fontSize: 11, fontWeight: "900", color: colors.textMuted },
  ruleToggleTextOn: { color: colors.good },
  deleteBtn: { padding: 4 },

  hitCard: { marginBottom: 10 },
  hitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hitPhoto: { width: 56, height: 56, borderRadius: 10 },
  hitPhotoPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  hitTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  hitBrand: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  hitMeta: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  hitPriceWrap: {
    backgroundColor: colors.goodGlow,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.good,
  },
  hitPrice: { color: colors.good, fontSize: 16, fontWeight: "900" },
  hitOpen: { color: colors.good, fontSize: 9, fontWeight: "900", letterSpacing: 0.5, marginTop: 3, textAlign: "center" },

  tipsCard: { marginTop: 8, marginBottom: 12 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  tipText: { color: colors.textMuted, fontSize: 12, flex: 1 },

  emptyText: { color: colors.textMuted, textAlign: "center", fontWeight: "700" },
  emptyHint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 18 },

  clearText: { color: colors.urgent, fontSize: 12, fontWeight: "700" },
});
