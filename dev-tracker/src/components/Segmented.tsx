import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../lib/theme';

interface Option {
  value: number;
  label: string;
}

interface Props {
  options: Option[];
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

export function Segmented({ options, value, onChange, label }: Props) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, value === opt.value && styles.active]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.optText, value === opt.value && styles.activeText]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.sm },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.creamMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.inkMid,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  active: {
    backgroundColor: COLORS.amberGlow,
    borderWidth: 1,
    borderColor: COLORS.amberDim,
  },
  optText: {
    fontFamily: FONTS.bodyMed,
    fontSize: 12,
    color: COLORS.creamMuted,
  },
  activeText: {
    color: COLORS.amber,
  },
});
