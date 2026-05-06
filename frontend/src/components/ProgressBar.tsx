import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../theme/colors";

export function ProgressBar({
  progress,
  color = colors.good,
  trackColor,
  label,
  valueLabel,
  height = 6,
}: {
  progress: number;
  color?: string;
  trackColor?: string;
  label?: string;
  valueLabel?: string;
  height?: number;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View>
      {(label || valueLabel) ? (
        <View style={styles.header}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {valueLabel ? <Text style={[styles.val, { color }]}>{valueLabel}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.track, { height, backgroundColor: trackColor ?? colors.surfaceElevated }]}>
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color, height }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  val: { fontSize: 12, fontWeight: "800" },
  track: { borderRadius: radius.pill, overflow: "hidden" },
  fill: { borderRadius: radius.pill },
});
