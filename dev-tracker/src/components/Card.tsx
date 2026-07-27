import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../lib/theme';

interface Props {
  number?: string;
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ number, title, children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        {number && (
          <View style={styles.numChip}>
            <Text style={styles.numText}>{number}</Text>
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inkBorder,
    gap: SPACING.sm,
  },
  numChip: {
    backgroundColor: COLORS.amberGlow,
    borderWidth: 1,
    borderColor: COLORS.amberDim,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  numText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.amber,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: COLORS.cream,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  body: {
    padding: SPACING.md,
  },
});
