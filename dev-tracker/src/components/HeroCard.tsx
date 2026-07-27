import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DayScore } from '../lib/types';
import { COLORS, FONTS, SPACING, RADIUS } from '../lib/theme';
import { PentagonRadar } from './PentagonRadar';

interface PlanProps {
  mode: 'plan';
  date: string;
  cible: string;
  level: number;
  streak: number;
  filled: number;
  fragments: { mission: number; voies: number; rites: number };
}

interface ReviewProps {
  mode: 'review';
  date: string;
  cible: string;
  score: DayScore;
  level: number;
  streak: number;
  interpLabel: string;
  interpColor: string;
  validated: boolean;
}

type Props = PlanProps | ReviewProps;

function CornerMark({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s = 10;
  const isRight = pos.endsWith('r');
  const isBottom = pos.startsWith('b');
  return (
    <View
      style={{
        position: 'absolute',
        [isBottom ? 'bottom' : 'top']: 10,
        [isRight ? 'right' : 'left']: 10,
        width: s,
        height: s,
        borderTopWidth: isBottom ? 0 : 1.5,
        borderBottomWidth: isBottom ? 1.5 : 0,
        borderLeftWidth: isRight ? 0 : 1.5,
        borderRightWidth: isRight ? 1.5 : 0,
        borderColor: COLORS.amberDim,
        opacity: 0.6,
      }}
    />
  );
}

export function HeroCard(props: Props) {
  const dayOfYear = Math.floor(
    (new Date(props.date).getTime() - new Date(new Date(props.date).getFullYear(), 0, 0).getTime()) / 86400000
  );
  const serial = String(dayOfYear).padStart(4, '0');

  return (
    <View style={styles.card}>
      <CornerMark pos="tl" />
      <CornerMark pos="tr" />
      <CornerMark pos="bl" />
      <CornerMark pos="br" />

      {/* Header meta */}
      <View style={styles.metaRow}>
        <Text style={styles.kicker}>JOURNAL DE BORD</Text>
        <Text style={styles.serial}>N° {serial}</Text>
      </View>

      {/* Date */}
      <Text style={styles.dateStr}>{formatDate(props.date)}</Text>

      {/* Cible */}
      {props.cible ? (
        <Text style={styles.cible} numberOfLines={2}>{props.cible}</Text>
      ) : (
        <Text style={styles.cibleEmpty}>— Cible non définie —</Text>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Mode-specific content */}
      {props.mode === 'plan' ? (
        <PlanContent {...props} />
      ) : (
        <ReviewContent {...props} />
      )}

      {/* Footer: level + streak */}
      <View style={styles.footer}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>NIV.</Text>
          <Text style={styles.badgeVal}>{props.level}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>SÉRIE</Text>
          <Text style={styles.badgeVal}>{props.streak}j</Text>
        </View>
      </View>
    </View>
  );
}

function PlanContent({ filled, fragments }: PlanProps) {
  const bars = [
    { key: 'C', label: 'CIBLE', val: fragments.mission, max: 3, color: COLORS.blue },
    { key: 'V', label: 'VOIES', val: fragments.voies, max: 3, color: COLORS.orange },
    { key: 'R', label: 'RITES', val: fragments.rites, max: 2, color: COLORS.amber },
  ];
  return (
    <View style={styles.planContent}>
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: 'rgba(110,138,181,0.15)', borderColor: COLORS.blue }]}>
          <Text style={[styles.chipText, { color: COLORS.blue }]}>PLAN EN COURS</Text>
        </View>
        <Text style={styles.filledPct}>{Math.round(filled * 100)}%</Text>
      </View>
      <Text style={styles.esquisseLbl}>ESQUISSE</Text>
      {bars.map(b => (
        <View key={b.key} style={styles.sketchRow}>
          <Text style={styles.sketchKey}>{b.key}</Text>
          <View style={styles.sketchBg}>
            <View style={[styles.sketchFill, { width: `${(b.val / b.max) * 100}%`, backgroundColor: b.color }]} />
          </View>
          <Text style={[styles.sketchNum, { color: b.color }]}>{b.val}/{b.max}</Text>
        </View>
      ))}
    </View>
  );
}

function ReviewContent({ score, interpLabel, interpColor, validated }: ReviewProps) {
  return (
    <View style={styles.reviewContent}>
      <View style={styles.chipRow}>
        <View style={[
          styles.chip,
          validated
            ? { backgroundColor: COLORS.amberGlow, borderColor: COLORS.amberDim }
            : { backgroundColor: 'rgba(232,144,66,0.15)', borderColor: COLORS.orange },
        ]}>
          <Text style={[styles.chipText, { color: validated ? COLORS.amber : COLORS.orange }]}>
            {validated ? 'SCEAU APPOSÉ' : 'BILAN OUVERT'}
          </Text>
        </View>
      </View>
      <View style={styles.radarRow}>
        <PentagonRadar score={score} size={160} showLabels showCenter />
        <View style={styles.radarMeta}>
          <Text style={[styles.interpLabel, { color: interpColor }]}>{interpLabel}</Text>
          <Text style={styles.scoreDisplay}>{score.total}<Text style={styles.scoreMax}>/10</Text></Text>
          {!validated && (
            <Text style={styles.provisoire}>provisoire</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${days[dt.getDay()]} ${d} ${months[m - 1]}. ${y}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.amberDim,
    letterSpacing: 2,
  },
  serial: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.creamMuted,
    letterSpacing: 1,
  },
  dateStr: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: COLORS.cream,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  cible: {
    fontFamily: FONTS.bodySemi,
    fontSize: 18,
    color: COLORS.cream,
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  cibleEmpty: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.creamMuted,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.inkBorder,
    marginBottom: SPACING.md,
  },
  planContent: { gap: SPACING.sm },
  reviewContent: { gap: SPACING.sm },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 1,
  },
  filledPct: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.creamMuted,
  },
  esquisseLbl: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.creamMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  sketchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sketchKey: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    color: COLORS.creamMuted,
    width: 12,
  },
  sketchBg: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.inkMuted,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sketchFill: {
    height: '100%',
    borderRadius: 999,
  },
  sketchNum: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    width: 24,
    textAlign: 'right',
  },
  radarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  radarMeta: {
    flex: 1,
    gap: 6,
  },
  interpLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 14,
  },
  scoreDisplay: {
    fontFamily: FONTS.monoBold,
    fontSize: 32,
    color: COLORS.cream,
    lineHeight: 36,
  },
  scoreMax: {
    fontSize: 14,
    color: COLORS.creamMuted,
  },
  provisoire: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.orange,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.inkBorder,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.inkMid,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
  },
  badgeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.creamMuted,
    letterSpacing: 0.5,
  },
  badgeVal: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: COLORS.amber,
  },
});
