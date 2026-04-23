import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { colors, radius } from "../theme/colors";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  const v = variants[variant];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.text, { color: v.fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const variants = {
  primary: { bg: colors.good, fg: "#000000", border: colors.good },
  secondary: {
    bg: colors.surfaceElevated,
    fg: colors.textPrimary,
    border: colors.border,
  },
  danger: { bg: colors.urgentBg, fg: colors.urgent, border: colors.urgentBorder },
  ghost: { bg: "transparent", fg: colors.textPrimary, border: colors.border },
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  text: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
});
