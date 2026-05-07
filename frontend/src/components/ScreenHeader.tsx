import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerDot} />
          <Text style={styles.kicker}>VINTED MANAGER</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.good,
    shadowColor: colors.good,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  kicker: {
    color: colors.good,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 5,
    fontWeight: "500",
  },
});
