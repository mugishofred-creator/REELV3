import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/colors";

export function ImagePickerField({
  value,
  onChange,
  testID,
}: {
  value?: string;
  onChange: (base64?: string) => void;
  testID?: string;
}) {
  const pick = async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission refusée",
          "L'accès à la galerie est nécessaire pour ajouter une photo."
        );
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.4,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const data = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    onChange(data);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>PHOTO (OPTIONNEL)</Text>
      <TouchableOpacity
        onPress={pick}
        activeOpacity={0.85}
        style={styles.box}
        testID={testID}
      >
        {value ? (
          <Image source={{ uri: value }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
            <Text style={styles.hint}>Choisir une photo</Text>
          </View>
        )}
      </TouchableOpacity>
      {value && (
        <TouchableOpacity
          onPress={() => onChange(undefined)}
          style={styles.remove}
          testID={testID ? `${testID}-remove` : undefined}
        >
          <Text style={styles.removeText}>Retirer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  box: {
    height: 160,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
  },
  remove: { alignSelf: "flex-start", marginTop: 8 },
  removeText: {
    color: colors.urgent,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
