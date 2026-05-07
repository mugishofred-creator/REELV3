import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

export function MiniBarChart({
  data,
  color = colors.good,
  height = 48,
}: {
  data: Array<{ label: string; value: number; highlight?: boolean }>;
  color?: string;
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <View>
      <View style={[styles.bars, { height }]}>
        {data.map((d, i) => {
          const ratio = Math.abs(d.value) / maxVal;
          const barH = Math.max(4, ratio * height);
          const isNeg = d.value < 0;
          const barColor = d.highlight
            ? color
            : isNeg
            ? `${colors.urgent}55`
            : `${color}44`;
          return (
            <View key={i} style={[styles.col, { height }]}>
              <View style={[styles.bar, { height: barH, backgroundColor: barColor }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labelRow}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.lbl, d.highlight && { color: color }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  col: { flex: 1, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3 },
  labelRow: { flexDirection: "row", marginTop: 6, gap: 4 },
  lbl: { flex: 1, textAlign: "center", color: colors.textMuted, fontSize: 9, fontWeight: "600" },
});
