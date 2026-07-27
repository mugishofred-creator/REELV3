import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/colors";

export function EmptyState({
  icon = "leaf-outline",
  title,
  subtitle,
  children,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.good} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.xxl,
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  actions: {
    marginTop: 16,
    width: "100%",
    gap: 8,
  },
});
