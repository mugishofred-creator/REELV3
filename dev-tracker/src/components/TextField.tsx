import React, { useState } from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../lib/theme';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
}

export function TextField({ label, hint, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...props}
        style={[
          styles.input,
          focused && styles.focused,
          style,
        ]}
        placeholderTextColor={COLORS.creamMuted}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
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
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.inkMid,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.cream,
  },
  focused: {
    borderColor: COLORS.amber,
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.creamMuted,
    marginTop: 4,
  },
});
