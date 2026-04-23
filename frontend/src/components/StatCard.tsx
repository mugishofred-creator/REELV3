import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../theme/colors";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  testID,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "urgent" | "warning" | "neutral";
  testID?: string;
}) {
  const color =
    tone === "good"
      ? colors.good
      : tone === "urgent"
      ? colors.urgent
      : tone === "warning"
      ? colors.warning
      : colors.textPrimary;

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: 16,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 8,
    letterSpacing: -0.5,
  },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
});
