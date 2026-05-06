import React, { useMemo, useState, memo } from "react";
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useData, StockItem } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Thumb } from "../../src/components/Thumb";
import { ProgressBar } from "../../src/components/ProgressBar";
import { colors } from "../../src/theme/colors";
import { listingFlag, shouldRepost, forceDelete, suggestedPrice } from "../../src/utils/logic";
import { type Action, type ItemAnalysis } from "../../src/utils/analytics";
import { saleProbability, probColor, probLabel } from "../../src/utils/saleProbability";
import { useAnalyzedStock, type EnrichedItem } from "../../src/hooks/useAnalyzedStock";

type Filter = "all" | "urgent" | "ok";

const ACTION_RANK: Record<string, number> = {
  SUPPRIMER: 0, LIQUIDER: 1, BAISSE_IMMEDIATE: 2,
  BAISSER: 3, REPOST: 4, GARDER: 5, ANALYSE: 6,
};

const URGENCY_COLOR: Record<string, string> = {
  SUPPRIMER: colors.urgent, LIQUIDER: colors.urgent,
  BAISSE_IMMEDIATE: colors.warning, BAISSER: colors.warning,
  REPOST: colors.info, GARDER: colors.good, ANALYSE: colors.textMuted,
};

function actionTone(d: Action): "good" | "info" | "warning" | "urgent" {
  if (d === "GARDER") return "good";
  if (d === "ANALYSE") return "info";
  if (d === "BAISSER" || d === "REPOST") return "warning";
  return "urgent";
}

interface CardProps {
  item: StockItem;
  analysis: ItemAnalysis;
  ventes: ReturnType<typeof useData>["ventes"];
  onSold: () => void;
  onRepost: () => void;
  onDelete: () => void;
}

const StockCard = memo(function StockCard({
  item, analysis, ventes, onSold, onRepost, onDelete,
}: CardProps) {
  const { score, action, time, boost, estimatedProfit: profit } = analysis;
  const flag = listingFlag(item);
  const rp = shouldRepost(item);
  const forced = forceDelete(item);
  const suggest = suggestedPrice(item, ventes);
  const prob = saleProbability(item, ventes, analysis);
  const pColor = probColor(prob);
  const urgencyColor = URGENCY_COLOR[action] ?? colors.textMuted;

  return (
    <View style={styles.cardWrap} testID={`stock-item-${item.id}`}>
      <View style={[styles.urgencyStripe, { backgroundColor: urgencyColor }]} />
      <Card style={styles.cardInner}>
        {/* Header */}
        <View style={styles.itemHeader}>
          <Thumb uri={item.image} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemBrand}>{item.brand} · {item.category}</Text>
          </View>
          <Badge label={action.replace("_", " ")} tone={actionTone(action)} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Stat label="Score" value={`${score}`} tone={score >= 50 ? "good" : score < 25 ? "urgent" : "warning"} />
          <Stat
            label={time.rawHours < 24 ? "Heures" : "Jours"}
            value={time.rawHours < 24 ? `${Math.max(0, Math.round(time.rawHours))}h` : `${time.days.toFixed(0)}j`}
          />
          <Stat label="Vues" value={`${item.views}`} />
          <Stat label="❤" value={`${item.favorites}`} />
        </View>

        {/* Probability bar */}
        <View style={styles.probRow}>
          <Text style={styles.probLabel}>
            Probabilité vente:{" "}
            <Text style={[styles.probValue, { color: pColor }]}>
              {probLabel(prob)} {prob}%
            </Text>
          </Text>
        </View>
        <ProgressBar progress={prob / 100} color={pColor} height={4} />

        {/* Prices */}
        <View style={styles.priceRow}>
          <PricePill label="Achat" value={item.buyPrice > 0 ? `${item.buyPrice}€` : "—"} />
          <PricePill label="Vente" value={`${item.sellPrice}€`} />
          {profit !== null && (
            <PricePill
              label="Bénéf"
              value={`${profit >= 0 ? "+" : ""}${profit.toFixed(0)}€`}
              color={profit >= 0 ? colors.good : colors.urgent}
            />
          )}
          {suggest > 0 && suggest !== item.sellPrice && (
            <PricePill label="Suggéré" value={`${suggest}€`} color={colors.good} />
          )}
        </View>

        {/* Badges */}
        {(boost.verdict === "BOOST" || item.defect || flag || forced || item.repostCount > 0) && (
          <View style={styles.badgesRow}>
            {boost.verdict === "BOOST" && <Badge label="🟢 Booster" tone="good" />}
            {boost.verdict === "ATTENDRE" && <Badge label="⏳ Attendre boost" tone="warning" />}
            {item.defect && <Badge label="Défaut" tone="urgent" />}
            {flag && <Badge label={flag} tone="warning" />}
            {rp && !forced && <Badge label="À reposter" tone="info" />}
            {forced && <Badge label="⚠ Forcer suppr." tone="urgent" />}
            {item.repostCount > 0 && <Badge label={`Repost ×${item.repostCount}`} tone="neutral" />}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button label="✓ Vendu" variant="primary" onPress={onSold} style={{ flex: 1 }} testID={`stock-sold-${item.id}`} />
          <Button label="↺ Reposter" variant="secondary" onPress={onRepost} style={{ flex: 1 }} testID={`stock-repost-${item.id}`} />
          <Button label="✕" variant="danger" onPress={onDelete} style={{ minWidth: 44 }} testID={`stock-delete-${item.id}`} />
        </View>
      </Card>
    </View>
  );
});

export default function StockScreen() {
  const router = useRouter();
  const { stock, ventes, deleteStock, updateStock, markSold } = useData();
  const analyzed = useAnalyzedStock();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return analyzed
      .filter(({ item, analysis: a }) => {
        const matchFilter =
          filter === "urgent"
            ? a.action === "SUPPRIMER" || a.action === "LIQUIDER" || a.action === "BAISSE_IMMEDIATE"
            : filter === "ok"
            ? a.action === "GARDER"
            : true;
        const matchSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        return matchFilter && matchSearch;
      })
      .sort(
        (a, b) =>
          (ACTION_RANK[a.analysis.action] ?? 9) -
          (ACTION_RANK[b.analysis.action] ?? 9)
      );
  }, [analyzed, filter, search]);

  const urgentCount = useMemo(
    () =>
      analyzed.filter(
        ({ analysis: a }) =>
          a.action === "SUPPRIMER" ||
          a.action === "LIQUIDER" ||
          a.action === "BAISSE_IMMEDIATE"
      ).length,
    [analyzed]
  );

  const handleRepost = (i: StockItem) =>
    updateStock(i.id, { views: 0, favorites: 0, daysOnline: 0, repostCount: (i.repostCount || 0) + 1 });

  const confirmDelete = (i: StockItem) =>
    Alert.alert("Supprimer", `Retirer "${i.name}" du stock ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteStock(i.id) },
    ]);

  const renderItem = ({ item: e }: { item: EnrichedItem }) => (
    <StockCard
      item={e.item}
      analysis={e.analysis}
      ventes={ventes}
      onSold={() => markSold(e.item.id)}
      onRepost={() => handleRepost(e.item)}
      onDelete={() => confirmDelete(e.item)}
    />
  );

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.container}
      testID="stock-scroll"
      data={filtered}
      keyExtractor={(e) => e.item.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <>
          <ScreenHeader
            title="Stock"
            subtitle={`${stock.length} article${stock.length > 1 ? "s" : ""}${urgentCount > 0 ? ` · ${urgentCount} urgent${urgentCount > 1 ? "s" : ""}` : ""}`}
            right={
              <TouchableOpacity
                onPress={() => router.push("/stock-new")}
                style={styles.addBtn}
                testID="stock-add-btn"
              >
                <Ionicons name="add" size={22} color="#000" />
              </TouchableOpacity>
            }
          />

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Nom, marque, catégorie…"
              placeholderTextColor={colors.textMuted}
              testID="stock-search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filters}>
            {(["all", "urgent", "ok"] as const).map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setFilter(k)}
                style={[styles.filter, filter === k && styles.filterActive]}
                testID={`stock-filter-${k}`}
              >
                <Text style={[styles.filterText, filter === k && { color: "#000" }]}>
                  {k === "all" ? "Tous" : k === "urgent" ? `🔴 Urgent${urgentCount > 0 ? ` (${urgentCount})` : ""}` : "✓ Garder"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      ListEmptyComponent={
        <Card testID="stock-empty">
          <Text style={styles.empty}>
            {search || filter !== "all"
              ? "Aucun résultat pour ces filtres."
              : "Stock vide — ajoute ton premier article !"}
          </Text>
          {!search && filter === "all" && (
            <Button label="+ Ajouter un article" onPress={() => router.push("/stock-new")} testID="stock-empty-add" />
          )}
        </Card>
      }
      ListFooterComponent={<View style={{ height: 40 }} />}
    />
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "urgent" | "warning" }) {
  const col = tone === "good" ? colors.good : tone === "urgent" ? colors.urgent : tone === "warning" ? colors.warning : colors.textPrimary;
  return (
    <View style={stStyles.box}>
      <Text style={stStyles.l}>{label}</Text>
      <Text style={[stStyles.v, { color: col }]}>{value}</Text>
    </View>
  );
}

function PricePill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={ppStyles.wrap}>
      <Text style={ppStyles.label}>{label}</Text>
      <Text style={[ppStyles.value, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const stStyles = StyleSheet.create({
  box: { flex: 1, alignItems: "center" },
  l: { color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  v: { color: colors.textPrimary, fontSize: 15, fontWeight: "900", marginTop: 2 },
});

const ppStyles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 6, paddingVertical: 4, backgroundColor: colors.surfaceElevated, borderRadius: 8 },
  label: { color: colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  value: { color: colors.textPrimary, fontSize: 13, fontWeight: "900", marginTop: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 100 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.good, alignItems: "center", justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 12, marginBottom: 10,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 10 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 14 },
  filter: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.good, borderColor: colors.good },
  filterText: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  empty: { color: colors.textMuted, textAlign: "center", marginBottom: 16 },
  cardWrap: { flexDirection: "row", marginBottom: 12, borderRadius: 14, overflow: "hidden" },
  urgencyStripe: { width: 4 },
  cardInner: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
  itemHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  itemName: { color: colors.textPrimary, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  itemBrand: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statsRow: {
    flexDirection: "row", paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSoft, marginBottom: 10,
  },
  probRow: { marginBottom: 4 },
  probLabel: { color: colors.textMuted, fontSize: 11 },
  probValue: { fontWeight: "800" },
  priceRow: { flexDirection: "row", gap: 6, marginTop: 10, marginBottom: 10, flexWrap: "wrap" },
  badgesRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  actions: { flexDirection: "row", gap: 8 },
});
