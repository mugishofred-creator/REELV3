import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, radius } from "../theme/colors";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  return (
    <View style={styles.wrap} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            activeOpacity={0.85}
            onPress={() => onChange(o.value)}
            style={[styles.opt, active && styles.optActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  opt: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.pill,
  },
  optActive: {
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  labelActive: {
    color: colors.good,
  },
});
