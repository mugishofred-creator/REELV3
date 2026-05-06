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
import { colors } from "../../src/theme/colors";
import { listingFlag, shouldRepost, forceDelete, suggestedPrice } from "../../src/utils/logic";
import { type Action, type ItemAnalysis } from "../../src/utils/analytics";
import { useAnalyzedStock, type EnrichedItem } from "../../src/hooks/useAnalyzedStock";

const decisionTone = (d: Action) =>
  d === "GARDER"
    ? "good"
    : d === "ANALYSE"
    ? "info"
    : d === "BAISSER" || d === "REPOST"
    ? "warning"
    : "urgent";

const actionLabel = (d: Action) => d.replace("_", " ");

type Filter = "all" | "urgent" | "ok";

interface StockCardProps {
  item: StockItem;
  analysis: ItemAnalysis;
  ventes: ReturnType<typeof useData>["ventes"];
  onSold: () => void;
  onRepost: () => void;
  onDelete: () => void;
}

const StockCard = memo(function StockCard({
  item,
  analysis,
  ventes,
  onSold,
  onRepost,
  onDelete,
}: StockCardProps) {
  const { score, action: decision, time, boost, estimatedProfit: profit } = analysis;
  const flag = listingFlag(item);
  const rp = shouldRepost(item);
  const forced = forceDelete(item);
  const suggest = suggestedPrice(item, ventes);

  return (
    <Card style={styles.itemCard} testID={`stock-item-${item.id}`}>
      <View style={styles.itemHeader}>
        <Thumb uri={item.image} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemBrand}>
            {item.brand} • {item.category}
          </Text>
        </View>
        <Badge label={actionLabel(decision)} tone={decisionTone(decision)} />
      </View>

      <View style={styles.statsRow}>
        <Stat
          label="Score"
          value={`${score}`}
          tone={score >= 50 ? "good" : score < 25 ? "urgent" : "warning"}
        />
        <Stat
          label={time.rawHours < 24 ? "Heures" : "Jours"}
          value={
            time.rawHours < 24
              ? `${Math.max(0, Math.round(time.rawHours))}h`
              : `${time.days.toFixed(0)}`
          }
        />
        <Stat label="Vues" value={`${item.views}`} />
        <Stat label="❤" value={`${item.favorites}`} />
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>
          Achat{" "}
          <Text style={styles.priceValue}>
            {item.buyPrice > 0 ? `${item.buyPrice}€` : "—"}
          </Text>
        </Text>
        <Text style={styles.priceLabel}>
          Vente <Text style={styles.priceValue}>{item.sellPrice}€</Text>
        </Text>
        {profit !== null && (
          <Text style={styles.priceLabel}>
            Bénéf{" "}
            <Text
              style={[
                styles.priceValue,
                { color: profit >= 0 ? colors.good : colors.urgent },
              ]}
            >
              {profit >= 0 ? "+" : ""}
              {profit.toFixed(0)}€
            </Text>
          </Text>
        )}
        {profit === null && item.buyPrice <= 0 && (
          <Text style={styles.priceLabel}>Coût inconnu</Text>
        )}
        {suggest > 0 && suggest !== item.sellPrice && (
          <Text style={styles.priceLabel}>
            Suggéré{" "}
            <Text style={[styles.priceValue, { color: colors.good }]}>
              {suggest}€
            </Text>
          </Text>
        )}
      </View>

      <View style={styles.badgesRow}>
        {boost.verdict === "BOOST" && <Badge label="🟢 Booster" tone="good" />}
        {boost.verdict === "ATTENDRE" && (
          <Badge label="🟡 Attendre boost" tone="warning" />
        )}
        {boost.verdict === "NO_BOOST" && (
          <Badge label="🔴 Ne pas booster" tone="urgent" />
        )}
        {item.defect && <Badge label="Défaut" tone="urgent" />}
        {flag && <Badge label={flag} tone="warning" />}
        {rp && !forced && <Badge label="À reposter" tone="info" />}
        {forced && <Badge label="Forcer suppression" tone="urgent" />}
        {item.repostCount > 0 && (
          <Badge label={`Repost x${item.repostCount}`} tone="neutral" />
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label="Vendu"
          variant="primary"
          onPress={onSold}
          style={{ flex: 1 }}
          testID={`stock-sold-${item.id}`}
        />
        <Button
          label="Reposter"
          variant="secondary"
          onPress={onRepost}
          style={{ flex: 1 }}
          testID={`stock-repost-${item.id}`}
        />
        <Button
          label="Suppr."
          variant="danger"
          onPress={onDelete}
          style={{ flex: 1 }}
          testID={`stock-delete-${item.id}`}
        />
      </View>
    </Card>
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
    return analyzed.filter(({ item, analysis: a }) => {
      const matchFilter =
        filter === "urgent"
          ? a.action === "SUPPRIMER" ||
            a.action === "LIQUIDER" ||
            a.action === "BAISSE_IMMEDIATE"
          : filter === "ok"
          ? a.action === "GARDER"
          : true;
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [analyzed, filter, search]);

  const confirmDelete = (i: StockItem) => {
    Alert.alert("Supprimer", `Retirer "${i.name}" du stock ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => deleteStock(i.id),
      },
    ]);
  };

  const handleRepost = (i: StockItem) => {
    updateStock(i.id, {
      views: 0,
      favorites: 0,
      daysOnline: 0,
      repostCount: (i.repostCount || 0) + 1,
    });
  };

  const renderItem = ({ item: enriched }: { item: EnrichedItem }) => (
    <StockCard
      item={enriched.item}
      analysis={enriched.analysis}
      ventes={ventes}
      onSold={() => markSold(enriched.item.id)}
      onRepost={() => handleRepost(enriched.item)}
      onDelete={() => confirmDelete(enriched.item)}
    />
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      testID="stock-scroll"
      data={filtered}
      keyExtractor={(e) => e.item.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <>
          <ScreenHeader
            title="Stock"
            subtitle={`${stock.length} article${stock.length > 1 ? "s" : ""}`}
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
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher nom, marque, catégorie..."
              placeholderTextColor={colors.textMuted}
              testID="stock-search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
                <Text
                  style={[styles.filterText, filter === k && { color: "#000" }]}
                >
                  {k === "all" ? "Tous" : k === "urgent" ? "Urgent" : "À garder"}
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
              : "Aucun article. Ajoute ton premier !"}
          </Text>
          {!search && filter === "all" && (
            <Button
              label="+ Ajouter un article"
              onPress={() => router.push("/stock-new")}
              testID="stock-empty-add"
            />
          )}
        </Card>
      }
      ListFooterComponent={<View style={{ height: 40 }} />}
    />
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "urgent" | "warning";
}) {
  const col =
    tone === "good"
      ? colors.good
      : tone === "urgent"
      ? colors.urgent
      : tone === "warning"
      ? colors.warning
      : colors.textPrimary;
  return (
    <View style={stStyles.box}>
      <Text style={stStyles.l}>{label}</Text>
      <Text style={[stStyles.v, { color: col }]}>{value}</Text>
    </View>
  );
}

const stStyles = StyleSheet.create({
  box: { flex: 1, alignItems: "center" },
  l: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  v: { color: colors.textPrimary, fontSize: 16, fontWeight: "900", marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 100 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.good,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    paddingVertical: 10,
  },
  clearBtn: { padding: 4 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.good, borderColor: colors.good },
  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  empty: { color: colors.textMuted, textAlign: "center", marginBottom: 16 },
  itemCard: { marginBottom: 12 },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  itemBrand: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  priceLabel: { color: colors.textMuted, fontSize: 12 },
  priceValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  actions: { flexDirection: "row", gap: 8 },
});
