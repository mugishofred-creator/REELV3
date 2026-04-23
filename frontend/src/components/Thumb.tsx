import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/colors";

export function Thumb({
  uri,
  size = 56,
}: {
  uri?: string;
  size?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceElevated,
        }}
      />
    );
  }
  return (
    <View
      style={[
        styles.empty,
        { width: size, height: size, borderRadius: radius.md },
      ]}
    >
      <Ionicons name="shirt-outline" size={size * 0.45} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
