import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Image, Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card } from "../src/components/Card";
import { colors } from "../src/theme/colors";
import { extractUserId } from "../src/utils/vintedApi";
import type { DirectVintedItem } from "../src/utils/vintedDirect";
import {
  Competitor,
  loadCompetitors, addCompetitor, removeCompetitor, refreshCompetitor,
} from "../src/utils/competitors";

// ── WebView-based authenticated fetcher ───────────────────────────────────────
// React Native fetch() cannot bypass Vinted's CSRF protection.
// A hidden WebView on vinted.fr makes same-origin fetch() calls instead.

interface FetchCallback {
  resolve: (items: DirectVintedItem[]) => void;
  reject: (err: Error) => void;
}

function parseItemsFromWebView(raw: Record<string, unknown>[]): DirectVintedItem[] {
  return raw.map((item) => {
    const photos = (item.photos as Array<{ url?: string }> | undefined) ?? [];
    const priceRaw = item.price as { amount?: string } | number | string | undefined;
    const price =
      priceRaw && typeof priceRaw === "object" && "amount" in priceRaw
        ? parseFloat((priceRaw as { amount: string }).amount) || 0
        : parseFloat(String(priceRaw ?? 0)) || 0;
    return {
      id: String(item.id ?? ""),
      title: String(item.title ?? ""),
      price,
      brand: String(item.brand_title ?? ""),
      category: String(item.category_title ?? ""),
      photoUrl: photos[0]?.url ?? "",
      status: String(item.status ?? ""),
    };
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CompetitorsScreen() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const webViewRef = useRef<WebView>(null);
  const webViewReady = useRef(false);
  const pendingFetch = useRef<FetchCallback | null>(null);

  useEffect(() => {
    loadCompetitors().then(setCompetitors);
  }, []);

  const onWebViewMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        ok: boolean;
        items?: Record<string, unknown>[];
        error?: string;
      };
      if (!pendingFetch.current) return;
      if (msg.ok) {
        pendingFetch.current.resolve(parseItemsFromWebView(msg.items ?? []));
      } else {
        pendingFetch.current.reject(new Error(msg.error ?? "Erreur inconnue"));
      }
      pendingFetch.current = null;
    } catch { /* ignore malformed messages */ }
  }, []);

  const fetchItemsViaWebView = useCallback((userId: string): Promise<DirectVintedItem[]> => {
    return new Promise((resolve, reject) => {
      if (!webViewRef.current || !webViewReady.current) {
        reject(new Error("Page Vinted en cours de chargement, réessayez dans quelques secondes."));
        return;
      }

      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          pendingFetch.current = null;
          reject(new Error("Timeout — vérifiez votre connexion."));
        }
      }, 30000);

      pendingFetch.current = {
        resolve: (items) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(items);
        },
        reject: (err) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(err);
        },
      };

      webViewRef.current.injectJavaScript(`
        (async function() {
          function getXsrf() {
            var m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            if (!m) return null;
            try { return decodeURIComponent(m[1]); } catch(e) { return m[1]; }
          }
          function getCsrfMeta() {
            var el = document.querySelector('meta[name="csrf-token"]');
            return el ? el.getAttribute('content') : null;
          }
          function buildHeaders() {
            var h = { 'Accept': 'application/json, text/plain, */*', 'X-Requested-With': 'XMLHttpRequest' };
            var x = getXsrf();
            if (x) h['X-XSRF-TOKEN'] = x;
            var c = getCsrfMeta();
            if (c) h['X-CSRF-Token'] = c;
            return h;
          }
          try {
            var all = [];
            for (var p = 1; p <= 5; p++) {
              // Anonymous session — no credentials, fresh session cookies from incognito WebView
              var r = await fetch(
                '/api/v2/catalog/items?user_id=${userId}&page=' + p + '&per_page=96&order=newest_first',
                { headers: buildHeaders() }
              );
              var lastStatus = r.status;
              if (!r.ok) {
                var lastBody = '';
                try { lastBody = (await r.text()).slice(0, 250); } catch(e) {}
                // Fallback: try seller_id parameter
                var r2 = await fetch(
                  '/api/v2/catalog/items?seller_id=${userId}&page=' + p + '&per_page=96&order=newest_first',
                  { headers: buildHeaders() }
                );
                if (!r2.ok) {
                  throw new Error('HTTP ' + lastStatus + ' (xsrf=' + (getXsrf() ? 'oui' : 'non') + ') ' + lastBody);
                }
                r = r2;
              }
              var d = await r.json();
              var items = d.items || [];
              if (!items.length) break;
              all = all.concat(items);
              if (p >= ((d.pagination || {}).total_pages || 1)) break;
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({ ok: true, items: all }));
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false, error: e.message || String(e) }));
          }
        })();
        true;
      `);
    });
  }, []);

  const handleAdd = async () => {
    const raw = input.trim();
    if (!raw) return;
    const id = extractUserId(raw);
    if (!id || !/^\d+$/.test(id)) {
      Alert.alert("ID invalide", "Entre l'URL ou l'ID numérique du profil Vinted.");
      return;
    }
    const name = username.trim() || `Vendeur ${id}`;
    setAdding(true);
    try {
      const updated = await addCompetitor(id, name);
      setCompetitors(updated);
      setInput("");
      setUsername("");
    } catch {
      Alert.alert("Erreur", "Impossible d'ajouter ce concurrent.");
    } finally {
      setAdding(false);
    }
  };

  const handleRefresh = useCallback(async (compId: string) => {
    setRefreshingId(compId);
    try {
      const updated = await refreshCompetitor(compId, fetchItemsViaWebView);
      setCompetitors(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Erreur", `Impossible de récupérer les articles.\n\n${msg}`);
    } finally {
      setRefreshingId(null);
    }
  }, [fetchItemsViaWebView]);

  const handleDelete = (compId: string, name: string) => {
    Alert.alert("Supprimer", `Arrêter de surveiller ${name} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          const updated = await removeCompetitor(compId);
          setCompetitors(updated);
        },
      },
    ]);
  };

  return (
    <ModalScreen title="Concurrents" subtitle="Surveille les autres vendeurs">
      {/* Hidden WebView — makes authenticated API calls via same-origin fetch */}
      <WebView
        ref={webViewRef}
        source={{ uri: "https://www.vinted.fr" }}
        onLoadEnd={() => {
          setTimeout(() => { webViewReady.current = true; }, 800);
        }}
        onMessage={onWebViewMessage}
        javaScriptEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        domStorageEnabled
        style={styles.hiddenWebView}
      />

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Ajouter ── */}
        <Card style={styles.addCard}>
          <Text style={styles.addTitle}>Ajouter un concurrent</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Pseudo (ex: sneaker_fred)"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="URL ou ID Vinted"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.addBtn, (!input.trim() || adding) && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!input.trim() || adding}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="add" size={16} color="#000" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        </Card>

        {/* ── Liste ── */}
        {competitors.length === 0 ? (
          <Card>
            <Text style={styles.empty}>Aucun concurrent suivi.</Text>
            <Text style={styles.emptyHint}>
              Ajoute un profil Vinted pour suivre ses nouveaux articles et stratégie de prix.
            </Text>
          </Card>
        ) : (
          competitors.map((c) => (
            <Card key={c.id} style={styles.card}>
              {/* Header */}
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.compName}>{c.username}</Text>
                  <Text style={styles.compMeta}>
                    ID {c.vintedId} · {c.currentItems.length} annonces
                  </Text>
                  {c.lastChecked && (
                    <Text style={styles.compTime}>
                      Vérifié {new Date(c.lastChecked).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </Text>
                  )}
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={() => handleRefresh(c.id)}
                    disabled={refreshingId === c.id}
                  >
                    {refreshingId === c.id ? (
                      <ActivityIndicator size="small" color={colors.good} />
                    ) : (
                      <Ionicons name="refresh" size={18} color={colors.good} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(c.id, c.username)}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stats row */}
              {c.lastChecked && (
                <View style={styles.statsRow}>
                  {c.newCount > 0 && (
                    <View style={styles.statChip}>
                      <Text style={[styles.statValue, { color: colors.good }]}>+{c.newCount}</Text>
                      <Text style={styles.statLabel}>nouveaux</Text>
                    </View>
                  )}
                  {c.removedCount > 0 && (
                    <View style={styles.statChip}>
                      <Text style={[styles.statValue, { color: colors.urgent }]}>-{c.removedCount}</Text>
                      <Text style={styles.statLabel}>retirés</Text>
                    </View>
                  )}
                  {c.avgPrice > 0 && (
                    <View style={styles.statChip}>
                      <Text style={styles.statValue}>{c.avgPrice.toFixed(0)}€</Text>
                      <Text style={styles.statLabel}>prix moy.</Text>
                    </View>
                  )}
                  {c.topBrand && (
                    <View style={styles.statChip}>
                      <Text style={[styles.statValue, { color: colors.info }]}>{c.topBrand.toUpperCase()}</Text>
                      <Text style={styles.statLabel}>top marque</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Toggle articles */}
              {c.currentItems.length > 0 && (
                <TouchableOpacity
                  style={styles.toggleArticles}
                  onPress={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  <Text style={styles.toggleText}>
                    {expanded === c.id ? "▲ Masquer les articles" : `▼ Voir ${c.currentItems.length} articles`}
                  </Text>
                </TouchableOpacity>
              )}

              {expanded === c.id && (
                <View style={styles.itemsList}>
                  {c.currentItems.slice(0, 10).map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      {item.photoUrl ? (
                        <Image source={{ uri: item.photoUrl }} style={styles.itemPhoto} />
                      ) : (
                        <View style={[styles.itemPhoto, styles.itemPhotoEmpty]} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                        {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}
                      </View>
                      <Text style={styles.itemPrice}>{item.price.toFixed(0)}€</Text>
                    </View>
                  ))}
                  {c.currentItems.length > 10 && (
                    <Text style={styles.moreItems}>+ {c.currentItems.length - 10} autres articles</Text>
                  )}
                </View>
              )}
            </Card>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  hiddenWebView: {
    position: "absolute",
    top: -2000,
    left: -2000,
    width: 1,
    height: 1,
  },

  content: { padding: 16, paddingBottom: 40 },

  addCard: { marginBottom: 16 },
  addTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", marginBottom: 12 },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 14, marginBottom: 10,
  },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: colors.good, borderRadius: 12, paddingVertical: 12,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: "#000", fontWeight: "900", fontSize: 14 },

  card: { marginBottom: 12 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  compName: { color: colors.textPrimary, fontSize: 15, fontWeight: "900" },
  compMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  compTime: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  cardActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.good, alignItems: "center", justifyContent: "center" },

  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  statChip: { backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  statValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "700", marginTop: 1 },

  toggleArticles: { paddingVertical: 6 },
  toggleText: { color: colors.info, fontSize: 12, fontWeight: "700" },

  itemsList: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  itemPhoto: { width: 40, height: 40, borderRadius: 8 },
  itemPhotoEmpty: { backgroundColor: colors.surfaceElevated },
  itemTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  itemBrand: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  itemPrice: { color: colors.good, fontSize: 13, fontWeight: "900" },
  moreItems: { color: colors.textMuted, fontSize: 11, textAlign: "center", paddingVertical: 6 },

  empty: { color: colors.textMuted, textAlign: "center", fontWeight: "700" },
  emptyHint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 18 },
});
