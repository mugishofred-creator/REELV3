import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { colors } from "../src/theme/colors";
import { useData } from "../src/store/context";
import { computeNiches } from "../src/utils/logic";

// ── Niche database (FR Vinted 2025-2026, researched) ──────────────────────────

type NicheDB = {
  brand: string;
  category: string;
  buyMin: number;
  buyMax: number;
  sellMin: number;
  sellMax: number;
  margin: string;
  season: string;
  tip: string;
};

const NICHE_DATABASE: NicheDB[] = [
  { brand: "Carhartt", category: "Workwear / Street", buyMin: 5, buyMax: 15, sellMin: 25, sellMax: 65, margin: "200–400%", season: "Automne/Hiver", tip: "WIP Detroit, vestes canvas · très demandés" },
  { brand: "Ralph Lauren", category: "Preppy / Casual", buyMin: 5, buyMax: 12, sellMin: 20, sellMax: 55, margin: "200–400%", season: "Toutes saisons", tip: "Polos brodés, pulls · indémodable" },
  { brand: "The North Face", category: "Outdoor / Urbain", buyMin: 10, buyMax: 25, sellMin: 40, sellMax: 110, margin: "200–350%", season: "Automne/Hiver", tip: "Nuptse, Denali · valeur sûre et stable" },
  { brand: "Nike Vintage", category: "Sportswear", buyMin: 5, buyMax: 15, sellMin: 20, sellMax: 55, margin: "150–300%", season: "Toutes saisons", tip: "Swoosh brodé, Tech Fleece · old school" },
  { brand: "Levi's 501", category: "Denim", buyMin: 5, buyMax: 12, sellMin: 20, sellMax: 45, margin: "200–400%", season: "Toutes saisons", tip: "501 vintage · grande taille = + cher" },
  { brand: "Lacoste", category: "Tennis / Classique", buyMin: 5, buyMax: 12, sellMin: 22, sellMax: 55, margin: "200–400%", season: "Printemps/Été", tip: "Polos baguettes, pulls · Made in France ++" },
  { brand: "Tommy Hilfiger", category: "Preppy / Street", buyMin: 4, buyMax: 10, sellMin: 18, sellMax: 45, margin: "200–400%", season: "Toutes saisons", tip: "Logo visible · Hilfiger Denim, puffers" },
  { brand: "Stone Island", category: "Luxury Street", buyMin: 30, buyMax: 80, sellMin: 120, sellMax: 350, margin: "200–350%", season: "Automne/Hiver", tip: "Badge authentique crucial · peu de faux" },
  { brand: "CP Company", category: "Luxury Street", buyMin: 25, buyMax: 60, sellMin: 80, sellMax: 250, margin: "200–300%", season: "Automne/Hiver", tip: "Goggle jacket, lenticulaire · rareté = valeur" },
  { brand: "Adidas Vintage", category: "Sportswear", buyMin: 5, buyMax: 12, sellMin: 18, sellMax: 45, margin: "150–300%", season: "Toutes saisons", tip: "Firebird, Gazelle · very old stock" },
  { brand: "Polo Sport Ralph", category: "90s Sport", buyMin: 8, buyMax: 18, sellMin: 30, sellMax: 70, margin: "200–350%", season: "Printemps/Été", tip: "Années 90 très tendance · pièces rares" },
  { brand: "Arc'teryx", category: "Premium Outdoor", buyMin: 30, buyMax: 80, sellMin: 120, sellMax: 400, margin: "200–400%", season: "Automne/Hiver", tip: "Alpha, Beta · niche premium en croissance" },
  { brand: "Nike Air Force 1", category: "Sneakers", buyMin: 15, buyMax: 35, sellMin: 50, sellMax: 120, margin: "150–300%", season: "Toutes saisons", tip: "OG blanc pristine · très liquide" },
  { brand: "Air Jordan", category: "Sneakers", buyMin: 30, buyMax: 80, sellMin: 80, sellMax: 250, margin: "150–300%", season: "Toutes saisons", tip: "1, 4, 11 · deadstock =+ valeur importante" },
  { brand: "Moncler", category: "Luxury Down", buyMin: 50, buyMax: 150, sellMin: 180, sellMax: 600, margin: "200–350%", season: "Hiver", tip: "Badge authentique · très volatile" },
  { brand: "Supreme", category: "Streetwear Premium", buyMin: 20, buyMax: 60, sellMin: 60, sellMax: 300, margin: "200–400%", season: "Toutes saisons", tip: "Box logo, collab · étiquettes = valeur" },
  { brand: "Barbour", category: "British Classic", buyMin: 15, buyMax: 40, sellMin: 50, sellMax: 150, margin: "200–350%", season: "Automne/Hiver", tip: "Quilted, waxed · très stable dans le temps" },
  { brand: "Patagonia", category: "Outdoor / Eco", buyMin: 15, buyMax: 35, sellMin: 50, sellMax: 150, margin: "200–350%", season: "Automne/Hiver", tip: "Fleece, Retro-X · clientèle engagée" },
  { brand: "Fila Vintage", category: "90s Tennis", buyMin: 5, buyMax: 12, sellMin: 18, sellMax: 40, margin: "150–300%", season: "Printemps/Été", tip: "Italia · court archive · sets complets" },
  { brand: "Kaporal", category: "French Denim", buyMin: 3, buyMax: 8, sellMin: 12, sellMax: 28, margin: "150–350%", season: "Toutes saisons", tip: "Jeune audience · vend bien sous 20 €" },
  { brand: "Stüssy", category: "Streetwear", buyMin: 15, buyMax: 40, sellMin: 50, sellMax: 150, margin: "150–300%", season: "Toutes saisons", tip: "Graphic tee, hoodie · vintage = prime" },
  { brand: "Acne Studios", category: "Designer", buyMin: 30, buyMax: 80, sellMin: 100, sellMax: 300, margin: "200–300%", season: "Toutes saisons", tip: "Écharpes, manteaux · très coté en France" },
];

const DB_CATEGORIES = ["Tous", "Streetwear", "Sportswear", "Outdoor", "Denim", "Sneakers", "Luxury"];

function categoryMatch(cat: string, filter: string): boolean {
  if (filter === "Tous") return true;
  const c = cat.toLowerCase();
  if (filter === "Streetwear") return c.includes("street") || c.includes("90s");
  if (filter === "Sportswear") return c.includes("sport") || c.includes("tennis");
  if (filter === "Outdoor") return c.includes("outdoor") || c.includes("down");
  if (filter === "Denim") return c.includes("denim");
  if (filter === "Sneakers") return c.includes("sneaker");
  if (filter === "Luxury") return c.includes("luxury") || c.includes("designer") || c.includes("premium");
  return true;
}

export default function NichesScreen() {
  const { ventes, niches, addNiche, updateNiche, deleteNiche } = useData();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [dbCategory, setDbCategory] = useState("Tous");

  const computed = useMemo(() => computeNiches(ventes), [ventes]);
  const best = computed[0];
  const worst = computed[computed.length - 1];

  const save = () => {
    if (!name.trim() || !brand.trim()) {
      Alert.alert("Champs requis", "Nom et marque obligatoires.");
      return;
    }
    addNiche({ name: name.trim(), brand: brand.trim(), status: "test", notes: "" });
    setName("");
    setBrand("");
  };

  return (
    <ModalScreen title="Niches" subtitle="Marques et performances">
      <ScrollView contentContainerStyle={styles.content} testID="niches-scroll">
        {computed.length > 0 && (
          <View style={styles.topRow}>
            {best && (
              <Card style={styles.half} testID="niches-best">
                <Badge label="Meilleure" tone="good" />
                <Text style={styles.brand}>{best.brand.toUpperCase()}</Text>
                <Text style={styles.meta}>Score {best.score}</Text>
                <Text style={styles.meta}>
                  +{best.avgProfit}€ • {best.avgDelay}j
                </Text>
              </Card>
            )}
            {worst && worst !== best && (
              <Card style={styles.half} testID="niches-worst">
                <Badge label="Pire" tone="urgent" />
                <Text style={styles.brand}>{worst.brand.toUpperCase()}</Text>
                <Text style={styles.meta}>Score {worst.score}</Text>
                <Text style={styles.meta}>
                  {worst.avgProfit >= 0 ? "+" : ""}
                  {worst.avgProfit}€ • {worst.avgDelay}j
                </Text>
              </Card>
            )}
          </View>
        )}

        {computed.length > 0 && (
          <Card style={{ marginTop: 16 }} testID="niches-ranking">
            <Text style={styles.sectionTitle}>CLASSEMENT</Text>
            {computed.map((n, idx) => (
              <View key={n.brand} style={styles.rankRow} testID={`niche-rank-${n.brand}`}>
                <Text style={styles.rank}>#{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName}>{n.brand.toUpperCase()}</Text>
                  <Text style={styles.meta}>
                    {n.count} ventes • {Math.round(n.successRate * 100)}% gagnants
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rankScore,
                    { color: n.score >= 1 ? colors.good : colors.urgent },
                  ]}
                >
                  {n.score}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── Base de données niches ── */}
        <Text style={styles.sectionTitle}>BASE DE NICHES FR 2025–2026</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dbStyles.filterScroll} contentContainerStyle={dbStyles.filterRow}>
          {DB_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[dbStyles.filterBtn, dbCategory === cat && dbStyles.filterBtnActive]}
              onPress={() => setDbCategory(cat)}
            >
              <Text style={[dbStyles.filterText, dbCategory === cat && dbStyles.filterTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {NICHE_DATABASE.filter((n) => categoryMatch(n.category, dbCategory)).map((n) => (
          <Card key={n.brand} style={dbStyles.card}>
            <View style={dbStyles.header}>
              <View style={{ flex: 1 }}>
                <Text style={dbStyles.brandName}>{n.brand}</Text>
                <Text style={dbStyles.category}>{n.category}</Text>
              </View>
              <View style={dbStyles.marginBadge}>
                <Text style={dbStyles.marginText}>{n.margin}</Text>
              </View>
            </View>
            <View style={dbStyles.priceRow}>
              <View style={dbStyles.priceItem}>
                <Text style={dbStyles.priceLabel}>Achat</Text>
                <Text style={dbStyles.priceValue}>{n.buyMin}–{n.buyMax} €</Text>
              </View>
              <View style={[dbStyles.priceItem, dbStyles.priceItemCenter]}>
                <Text style={dbStyles.arrow}>→</Text>
              </View>
              <View style={[dbStyles.priceItem, { alignItems: "flex-end" }]}>
                <Text style={dbStyles.priceLabel}>Vente</Text>
                <Text style={[dbStyles.priceValue, { color: colors.good }]}>{n.sellMin}–{n.sellMax} €</Text>
              </View>
            </View>
            <View style={dbStyles.footer}>
              <Text style={dbStyles.season}>{n.season}</Text>
              <Text style={dbStyles.tip}>{n.tip}</Text>
            </View>
          </Card>
        ))}

        <Text style={styles.sectionTitle}>MES NICHES MANUELLES</Text>
        <View style={styles.manualForm}>
          <Input label="Nom" value={name} onChangeText={setName} placeholder="Ex: Vintage Nike" testID="niche-name" />
          <Input label="Marque" value={brand} onChangeText={setBrand} placeholder="Ex: Nike" testID="niche-brand" />
          <Button label="Ajouter" onPress={save} testID="niche-add" />
        </View>

        {niches.map((n) => (
          <Card key={n.id} style={styles.manualCard} testID={`niche-${n.id}`}>
            <View style={styles.manualHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.manualName}>{n.name}</Text>
                <Text style={styles.meta}>{n.brand}</Text>
              </View>
              <Badge
                label={n.status === "test" ? "EN TEST" : "ACTIVE"}
                tone={n.status === "test" ? "warning" : "good"}
              />
            </View>
            <View style={styles.manualActions}>
              <TouchableOpacity
                onPress={() =>
                  updateNiche(n.id, {
                    status: n.status === "test" ? "active" : "test",
                  })
                }
                style={styles.chip}
                testID={`niche-toggle-${n.id}`}
              >
                <Text style={styles.chipText}>
                  {n.status === "test" ? "→ Active" : "→ En test"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteNiche(n.id)}
                style={[styles.chip, { borderColor: colors.urgentBorder }]}
                testID={`niche-delete-${n.id}`}
              >
                <Text style={[styles.chipText, { color: colors.urgent }]}>
                  Supprimer
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {computed.length === 0 && niches.length === 0 && (
          <Card>
            <Text style={styles.empty}>
              Aucune vente ni niche. Ajoute des ventes depuis le stock ou crée une niche test.
            </Text>
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ModalScreen>
  );
}

const dbStyles = StyleSheet.create({
  filterScroll: { marginBottom: 12 },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated,
  },
  filterBtnActive: { backgroundColor: colors.goodGlow, borderColor: colors.good },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.good },
  card: { marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  brandName: { color: colors.textPrimary, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  category: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  marginBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: colors.goodBg, borderWidth: 1, borderColor: colors.goodBorder,
  },
  marginText: { color: colors.good, fontSize: 12, fontWeight: "900" },
  priceRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  priceItem: { flex: 1 },
  priceItemCenter: { flex: 0, paddingHorizontal: 8 },
  priceLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  priceValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  arrow: { color: colors.textMuted, fontSize: 16 },
  footer: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8, gap: 3 },
  season: { color: colors.info, fontSize: 11, fontWeight: "700" },
  tip: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
});

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  topRow: { flexDirection: "row", gap: 12 },
  half: { flex: 1, gap: 6 },
  brand: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
    letterSpacing: -0.3,
  },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rank: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
    width: 28,
  },
  rankName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  rankScore: { fontSize: 16, fontWeight: "900" },
  manualForm: { marginBottom: 16 },
  manualCard: { marginBottom: 10 },
  manualHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  manualName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  manualActions: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  empty: { color: colors.textMuted, textAlign: "center" },
});
