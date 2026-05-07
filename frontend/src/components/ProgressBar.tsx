import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

export function ProgressBar({
  progress,
  color,
  label,
  valueLabel,
  height = 6,
}: {
  progress: number;
  color: string;
  label?: string;
  valueLabel?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View>
      {(label || valueLabel) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {valueLabel && <Text style={[styles.value, { color }]}>{valueLabel}</Text>}
        </View>
      )}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped * 100}%`,
              height,
              borderRadius: height / 2,
              backgroundColor: color,
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 5,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  value: { fontSize: 11, fontWeight: "800" },
  track: {
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
  },
  fill: {},
});
