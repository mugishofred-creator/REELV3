import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, shadow } from "../theme/colors";

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
    tone === "good" ? colors.good
    : tone === "urgent" ? colors.urgent
    : tone === "warning" ? colors.warning
    : colors.textPrimary;

  const topColor =
    tone === "good" ? colors.good
    : tone === "urgent" ? colors.urgent
    : tone === "warning" ? colors.warning
    : null;

  return (
    <View style={[styles.card, topColor && { borderTopColor: topColor, borderTopWidth: 2 }]} testID={testID}>
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
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 16,
    ...shadow.card,
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
    letterSpacing: -1,
    lineHeight: 32,
  },
  hint: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
});
