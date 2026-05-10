import React, { useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme/colors";

// JS injecté après chargement : cherche et clique le bouton "Acheter" de Vinted
const INJECT_BUY = `
(function() {
  var attempts = 0;
  var MAX = 24;

  function findBuyBtn() {
    var byTestId = document.querySelector(
      '[data-testid="buy-button"],[data-testid="buyButton"],[data-testid="buy_button"],[data-testid="item-buy-button"]'
    );
    if (byTestId) return byTestId;

    var byAttr = document.querySelector('[class*="buyButton"],[class*="buy-button"],[class*="BuyButton"],[id*="buy"]');
    if (byAttr) return byAttr;

    var btns = Array.from(document.querySelectorAll('button'));
    return btns.find(function(b) {
      var t = b.textContent.trim().toLowerCase();
      return t === 'acheter' || t === 'buy' || t.startsWith('acheter ') || t.startsWith('buy ');
    }) || null;
  }

  function tryBuy() {
    attempts++;
    var btn = findBuyBtn();
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function() {
        btn.click();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'clicked' }));
      }, 300);
      return;
    }
    if (attempts < MAX) {
      setTimeout(tryBuy, 500);
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'not_found' }));
    }
  }

  setTimeout(tryBuy, 1200);
})();
true;
`;

type Status = "loading" | "injecting" | "clicked" | "not_found";

export default function FastBuyScreen() {
  const { url, title, price } = useLocalSearchParams<{ url: string; title: string; price: string }>();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [status, setStatus] = useState<Status>("loading");

  const handleMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "clicked") setStatus("clicked");
      else if (msg.type === "not_found") setStatus("not_found");
    } catch { /* ignore */ }
  }, []);

  const handleLoadEnd = useCallback(() => {
    setStatus("injecting");
    webViewRef.current?.injectJavaScript(INJECT_BUY);
  }, []);

  const retryInject = useCallback(() => {
    setStatus("injecting");
    webViewRef.current?.injectJavaScript(INJECT_BUY);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title ?? "Achat rapide"}</Text>
          {price ? <Text style={styles.headerPrice}>{price} €</Text> : null}
        </View>
        {status === "loading" || status === "injecting" ? (
          <ActivityIndicator size="small" color={colors.good} style={{ marginRight: 4 }} />
        ) : status === "clicked" ? (
          <View style={styles.okBadge}>
            <Ionicons name="checkmark" size={12} color="#000" />
            <Text style={styles.okBadgeText}>OK</Text>
          </View>
        ) : null}
      </View>

      {/* Status banner */}
      {status === "loading" && (
        <View style={[styles.banner, styles.bannerInfo]}>
          <ActivityIndicator size="small" color={colors.info} />
          <Text style={styles.bannerText}>Chargement de la page…</Text>
        </View>
      )}
      {status === "injecting" && (
        <View style={[styles.banner, styles.bannerInfo]}>
          <ActivityIndicator size="small" color={colors.good} />
          <Text style={styles.bannerText}>Recherche du bouton Acheter…</Text>
        </View>
      )}
      {status === "clicked" && (
        <View style={[styles.banner, styles.bannerGood]}>
          <Ionicons name="flash" size={14} color="#000" />
          <Text style={[styles.bannerText, { color: "#000" }]}>
            Bouton cliqué — confirme le paiement ci-dessous
          </Text>
        </View>
      )}
      {status === "not_found" && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Ionicons name="warning-outline" size={14} color={colors.warning} />
          <Text style={[styles.bannerText, { color: colors.warning }]}>
            Bouton introuvable — connecte-toi si besoin
          </Text>
          <TouchableOpacity onPress={retryInject} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: url ?? "https://www.vinted.fr" }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        userAgent="Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  headerPrice: { color: colors.good, fontSize: 12, fontWeight: "900", marginTop: 1 },
  okBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.good, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  okBadgeText: { color: "#000", fontSize: 10, fontWeight: "900" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bannerInfo: { backgroundColor: colors.surface },
  bannerGood: { backgroundColor: colors.goodGlow, borderBottomColor: colors.good },
  bannerWarn: { backgroundColor: colors.surface },
  bannerText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  retryBtn: {
    backgroundColor: colors.warning,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  retryText: { color: "#000", fontSize: 11, fontWeight: "800" },

  webview: { flex: 1 },
});
