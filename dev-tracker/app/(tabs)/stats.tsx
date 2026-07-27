import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getAllEntries } from '../../src/lib/store';
import {
  scoreDay, isReviewed, calcStreak, calcTotalXP, calcLevel, calcAverageScore,
  interpLabel, interpColor,
} from '../../src/lib/scoring';
import { DayEntry } from '../../src/lib/types';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/lib/theme';
import { PentagonRadar } from '../../src/components/PentagonRadar';

interface Stats {
  streak: number;
  totalDays: number;
  avgScore: number;
  level: number;
  xpInLevel: number;
  xpNeeded: number;
  totalXP: number;
  avgPentagon: { mission: number; voies: number; rites: number; derives: number; maitrise: number; total: number; sceauZero: boolean };
  best: number;
  worst: number;
  maitrisePct: number;
  zeroPct: number;
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={statStyles.block}>
      <Text style={statStyles.val}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {sub && <Text style={statStyles.sub}>{sub}</Text>}
    </View>
  );
}

const statStyles = StyleSheet.create({
  block: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
  },
  val: {
    fontFamily: FONTS.monoBold,
    fontSize: 28,
    color: COLORS.amber,
    lineHeight: 32,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.creamMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
  },
  sub: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.creamMuted,
    textAlign: 'center',
  },
});

export default function StatsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await getAllEntries();
        const reviewed = Object.values(all).filter(isReviewed);

        const streak = calcStreak(all);
        const totalXP = calcTotalXP(all);
        const { level, xpInLevel, xpNeeded } = calcLevel(totalXP);
        const avgScore = calcAverageScore(all);
        const totalDays = reviewed.length;

        const scores = reviewed.map(e => scoreDay(e));
        const best = scores.length ? Math.max(...scores.map(s => s.total)) : 0;
        const worst = scores.length ? Math.min(...scores.map(s => s.total)) : 0;
        const maitrisePct = scores.length
          ? (scores.filter(s => s.maitrise === 1).length / scores.length) * 100
          : 0;
        const zeroPct = scores.length
          ? (scores.filter(s => s.sceauZero).length / scores.length) * 100
          : 0;

        // Average pentagon
        const avgPentagon = {
          mission: scores.length ? scores.reduce((a, s) => a + s.mission, 0) / scores.length : 0,
          voies: scores.length ? scores.reduce((a, s) => a + s.voies, 0) / scores.length : 0,
          rites: scores.length ? scores.reduce((a, s) => a + s.rites, 0) / scores.length : 0,
          derives: scores.length ? scores.reduce((a, s) => a + s.derives, 0) / scores.length : 0,
          maitrise: scores.length ? scores.reduce((a, s) => a + s.maitrise, 0) / scores.length : 0,
          total: avgScore,
          sceauZero: false,
        };

        setStats({ streak, totalDays, avgScore, level, xpInLevel, xpNeeded, totalXP, avgPentagon, best, worst, maitrisePct, zeroPct });
      })();
    }, [])
  );

  if (!stats) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>ANALYSE</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune donnée pour l'instant.</Text>
          <Text style={styles.emptyHint}>Scelle ton premier bilan pour voir tes stats.</Text>
        </View>
      </View>
    );
  }

  const xpPct = stats.xpNeeded > 0 ? stats.xpInLevel / stats.xpNeeded : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>ANALYSE</Text>
        <Text style={styles.subtitle}>{stats.totalDays} bilans validés</Text>
      </View>

      {/* Level card */}
      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <View>
            <Text style={styles.levelNum}>NIV. {stats.level}</Text>
            <Text style={styles.levelXP}>{stats.totalXP.toLocaleString()} XP total</Text>
          </View>
          <Text style={styles.levelXpIn}>{stats.xpInLevel}/{stats.xpNeeded} XP</Text>
        </View>
        <View style={styles.xpBg}>
          <View style={[styles.xpFill, { width: `${xpPct * 100}%` }]} />
        </View>
      </View>

      {/* Grid stats */}
      <View style={styles.grid}>
        <StatBlock label="Série" value={`${stats.streak}`} sub="jours consécutifs" />
        <StatBlock label="Moyenne" value={stats.avgScore.toFixed(1)} sub="/ 10" />
      </View>
      <View style={styles.grid}>
        <StatBlock label="Meilleur" value={`${stats.best}/10`} />
        <StatBlock label="Plus faible" value={`${stats.worst}/10`} />
      </View>
      <View style={styles.grid}>
        <StatBlock label="Maîtrise" value={`${Math.round(stats.maitrisePct)}%`} sub="des jours" />
        <StatBlock label="Sceau Zéro" value={`${Math.round(stats.zeroPct)}%`} sub="des jours" />
      </View>

      {/* Average Pentagon */}
      <View style={styles.radarCard}>
        <Text style={styles.sectionTitle}>RADAR MOYEN</Text>
        <Text style={styles.sectionHint}>Moyenne de tous tes bilans validés</Text>
        <View style={styles.radarCenter}>
          <PentagonRadar score={stats.avgPentagon} size={220} showLabels showCenter />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  header: {
    paddingTop: 56,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inkBorder,
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.cream,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.creamMuted,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontFamily: FONTS.bodyMed, fontSize: 16, color: COLORS.creamDim },
  emptyHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.creamMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  levelCard: {
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelNum: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.amber,
    letterSpacing: 1,
  },
  levelXP: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.creamMuted,
    marginTop: 2,
  },
  levelXpIn: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.creamDim,
  },
  xpBg: {
    height: 6,
    backgroundColor: COLORS.inkMuted,
    borderRadius: 999,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: COLORS.amber,
    borderRadius: 999,
  },
  grid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  radarCard: {
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.amber,
    letterSpacing: 2,
  },
  sectionHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.creamMuted,
    marginBottom: SPACING.md,
    marginTop: 2,
  },
  radarCenter: { alignItems: 'center' },
});
