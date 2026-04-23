import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { ImagePickerField } from "../src/components/ImagePickerField";
import { colors } from "../src/theme/colors";
import { useData } from "../src/store/context";
import { detectSeason } from "../src/utils/logic";

export default function StockNew() {
  const router = useRouter();
  const { addStock } = useData();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [views, setViews] = useState("0");
  const [favorites, setFavorites] = useState("0");
  const [daysOnline, setDaysOnline] = useState("0");
  const [defect, setDefect] = useState(false);
  const [image, setImage] = useState<string | undefined>(undefined);

  const save = () => {
    if (!name.trim() || !brand.trim() || !category.trim()) {
      Alert.alert("Champs requis", "Nom, marque et catégorie sont obligatoires.");
      return;
    }
    addStock({
      name: name.trim(),
      brand: brand.trim(),
      category: category.trim(),
      buyPrice: Number(buyPrice) || 0,
      sellPrice: Number(sellPrice) || 0,
      views: Number(views) || 0,
      favorites: Number(favorites) || 0,
      daysOnline: Number(daysOnline) || 0,
      defect,
      season: detectSeason(category),
      repostCount: 0,
      sold: false,
      image,
    });
    router.back();
  };

  return (
    <ModalScreen title="Nouvel article" subtitle="Ajoute-le à ton stock">
      <ScrollView contentContainerStyle={styles.content} testID="stock-new-scroll">
        <ImagePickerField value={image} onChange={setImage} testID="stock-new-image" />
        <Input
          label="Nom"
          value={name}
          onChangeText={setName}
          placeholder="Ex: Jean Levi's 501"
          testID="stock-new-name"
        />
        <Input
          label="Marque"
          value={brand}
          onChangeText={setBrand}
          placeholder="Ex: Levi's"
          testID="stock-new-brand"
        />
        <Input
          label="Catégorie"
          value={category}
          onChangeText={setCategory}
          placeholder="Ex: jean, tshirt, hoodie..."
          testID="stock-new-category"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Prix achat (€)"
              value={buyPrice}
              onChangeText={setBuyPrice}
              keyboardType="numeric"
              testID="stock-new-buy"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Prix vente (€)"
              value={sellPrice}
              onChangeText={setSellPrice}
              keyboardType="numeric"
              testID="stock-new-sell"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Vues"
              value={views}
              onChangeText={setViews}
              keyboardType="numeric"
              testID="stock-new-views"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Favoris"
              value={favorites}
              onChangeText={setFavorites}
              keyboardType="numeric"
              testID="stock-new-favs"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Jours"
              value={daysOnline}
              onChangeText={setDaysOnline}
              keyboardType="numeric"
              testID="stock-new-days"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setDefect((v) => !v)}
          style={[styles.toggle, defect && styles.toggleActive]}
          testID="stock-new-defect"
        >
          <View
            style={[styles.box, defect && { backgroundColor: colors.urgent, borderColor: colors.urgent }]}
          />
          <Text style={styles.toggleText}>Défaut / imperfection</Text>
        </TouchableOpacity>

        <Button
          label="Ajouter au stock"
          onPress={save}
          style={{ marginTop: 20 }}
          testID="stock-new-save"
        />
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 10 },
  toggle: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  toggleActive: { borderColor: colors.urgentBorder, backgroundColor: colors.urgentBg },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  toggleText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
});
