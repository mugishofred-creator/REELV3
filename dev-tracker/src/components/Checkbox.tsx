import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../lib/theme';

interface Props {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function Checkbox({ label, checked, onToggle, disabled }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.tick}>✓</Text>}
      </View>
      <Text style={[styles.label, disabled && styles.disabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: SPACING.sm,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.inkMid,
  },
  boxChecked: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.amberGlow,
  },
  tick: {
    color: COLORS.amber,
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    lineHeight: 14,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.cream,
    flex: 1,
  },
  disabled: {
    color: COLORS.creamMuted,
  },
});
