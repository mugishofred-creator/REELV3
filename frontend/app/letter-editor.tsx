import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { useData } from "../src/store/context";
import { colors, radius, shadow } from "../src/theme/colors";
import {
  DEFAULT_LETTER_TEMPLATE,
  PLACEHOLDER_LIST,
} from "../src/utils/letter";

export default function LetterEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { letters, addLetter, updateLetter } = useData();

  const existing = id ? letters.find((l) => l.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "Lettre type");
  const [body, setBody] = useState(existing?.body ?? DEFAULT_LETTER_TEMPLATE.body);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setBody(existing.body);
    }
  }, [existing]);

  const save = () => {
    if (!name.trim() || !body.trim()) {
      Alert.alert("Champs requis", "Donne un nom et un contenu à ta lettre.");
      return;
    }
    if (existing) {
      updateLetter(existing.id, { name: name.trim(), body });
    } else {
      addLetter({ name: name.trim(), body });
    }
    router.back();
  };

  const insertPlaceholder = (ph: string) => {
    setBody((b) => b + (b.endsWith(" ") || b.length === 0 ? "" : " ") + ph);
  };

  return (
    <ModalScreen
      title={existing ? "Modifier la lettre" : "Nouvelle lettre"}
      subtitle="Utilise des variables pour la personnaliser à chaque offre"
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
        <Input label="Nom" value={name} onChangeText={setName} />

        <View>
          <Text style={styles.label}>Variables à insérer</Text>
          <View style={styles.placeholderRow}>
            {PLACEHOLDER_LIST.map((ph) => (
              <TouchableOpacity
                key={ph}
                style={styles.phChip}
                onPress={() => insertPlaceholder(ph)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={11} color={colors.good} />
                <Text style={styles.phText}>{ph}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.label}>Contenu</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            style={styles.textarea}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={15} color="#000" />
          <Text style={styles.saveText}>ENREGISTRER</Text>
        </TouchableOpacity>
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  placeholderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  phChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
  },
  phText: {
    color: colors.good,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  textarea: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.textPrimary,
    fontSize: 14,
    padding: 14,
    minHeight: 280,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.good,
    ...shadow.glow,
  },
  saveText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
