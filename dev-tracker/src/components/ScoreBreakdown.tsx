import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DayScore } from '../lib/types';
import { COLORS, FONTS, SPACING } from '../lib/theme';

interface AxisRow {
  label: string;
  value: number;
  max: number;
  key: keyof DayScore;
}

const AXES: AxisRow[] = [
  { label: 'Cible', value: 0, max: 3, key: 'mission' },
  { label: 'Voies', value: 0, max: 3, key: 'voies' },
  { label: 'Rites', value: 0, max: 2, key: 'rites' },
  { label: 'Dérives', value: 0, max: 1, key: 'derives' },
  { label: 'Maîtrise', value: 0, max: 1, key: 'maitrise' },
];

interface Props {
  score: DayScore;
}

export function ScoreBreakdown({ score }: Props) {
  return (
    <View style={styles.container}>
      {AXES.map(axis => {
        const val = Number(score[axis.key]) || 0;
        const pct = axis.max > 0 ? val / axis.max : 0;
        return (
          <View key={axis.label} style={styles.row}>
            <Text style={styles.axisLabel}>{axis.label}</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
            </View>
            <Text style={styles.pts}>
              {val}/{axis.max}
            </Text>
          </View>
        );
      })}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalVal}>{score.total}/10</Text>
      </View>
      {score.sceauZero && (
        <View style={styles.zeroTag}>
          <Text style={styles.zeroText}>SCEAU ZÉRO — journée nulle</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  axisLabel: {
    fontFamily: FONTS.bodyMed,
    fontSize: 12,
    color: COLORS.creamDim,
    width: 68,
  },
  barBg: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.inkMuted,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.amber,
    borderRadius: 999,
  },
  pts: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.amber,
    width: 26,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.inkBorder,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  totalLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.creamMuted,
    letterSpacing: 1,
  },
  totalVal: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: COLORS.amber,
  },
  zeroTag: {
    backgroundColor: 'rgba(215,68,76,0.1)',
    borderWidth: 1,
    borderColor: COLORS.ember,
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignItems: 'center',
  },
  zeroText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.ember,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
