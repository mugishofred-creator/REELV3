import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../theme/colors";

export type Tone = "good" | "urgent" | "warning" | "info" | "neutral";

export function Badge({
  label,
  tone = "neutral",
  testID,
}: {
  label: string;
  tone?: Tone;
  testID?: string;
}) {
  const palette = tones[tone];
  return (
    <View
      style={[styles.base, { backgroundColor: palette.bg, borderColor: palette.border }]}
      testID={testID}
    >
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
  good: { bg: colors.goodBg, fg: colors.good, border: colors.goodBorder },
  urgent: { bg: colors.urgentBg, fg: colors.urgent, border: colors.urgentBorder },
  warning: { bg: colors.warningBg, fg: colors.warning, border: colors.warningBorder },
  info: { bg: colors.infoBg, fg: colors.info, border: colors.infoBorder },
  neutral: { bg: "rgba(255,255,255,0.06)", fg: colors.textSecondary, border: colors.border },
};

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
