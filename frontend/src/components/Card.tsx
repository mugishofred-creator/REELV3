import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, spacing, shadow } from "../theme/colors";

const ACCENT_COLORS: Record<string, string> = {
  good: colors.good,
  urgent: colors.urgent,
  warning: colors.warning,
  info: colors.info,
};

export function Card({
  children,
  style,
  testID,
  accent,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  accent?: "good" | "urgent" | "warning" | "info";
}) {
  const accentColor = accent ? ACCENT_COLORS[accent] : undefined;
  return (
    <View
      style={[
        styles.card,
        accentColor ? { borderLeftWidth: 3, borderLeftColor: accentColor } : undefined,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  subtitle,
  testID,
}: {
  title: string;
  subtitle?: string;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: 10,
    ...shadow.card,
  },
  section: { marginBottom: 10, marginTop: 20 },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  sectionSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.md,
  },
});
