import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, radius } from "../theme/colors";

export function Chip({
  label,
  active,
  onPress,
  color,
  size = "md",
  style,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  size?: "sm" | "md";
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  const accent = color ?? colors.good;
  const pad = size === "sm" ? { px: 10, py: 5 } : { px: 12, py: 7 };
  const fontSize = size === "sm" ? 10 : 12;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={[
        styles.base,
        {
          paddingHorizontal: pad.px,
          paddingVertical: pad.py,
          backgroundColor: active ? `${accent}22` : "rgba(255,255,255,0.04)",
          borderColor: active ? `${accent}66` : colors.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { fontSize, color: active ? accent : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
