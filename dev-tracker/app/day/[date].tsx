import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getEntry } from '../../src/lib/store';
import { scoreDay, isReviewed, parseDateKey, interpLabel, interpColor } from '../../src/lib/scoring';
import { DayEntry } from '../../src/lib/types';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/lib/theme';
import { PentagonRadar } from '../../src/components/PentagonRadar';
import { ScoreBreakdown } from '../../src/components/ScoreBreakdown';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataVal}>{value || '—'}</Text>
    </View>
  );
}

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<DayEntry | null>(null);
  const [notFound, setNotFound] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!date) return;
      (async () => {
        const e = await getEntry(date as string);
        if (e) setEntry(e);
        else setNotFound(true);
      })();
    }, [date])
  );

  if (notFound || !date) {
    return (
      <View style={styles.root}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune entrée pour cette date.</Text>
        </View>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.root}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  const dateStr = date as string;
  const dt = parseDateKey(dateStr);
  const reviewed = isReviewed(entry);
  const score = scoreDay(entry);
  const iLabel = interpLabel(score.total);
  const iColor = interpColor(score.total);

  const dayLabel = `${DAYS_FR[dt.getDay()]} ${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
  const dayOfYear = Math.floor(
    (dt.getTime() - new Date(dt.getFullYear(), 0, 0).getTime()) / 86400000
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>‹ Archives</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.serial}>N° {String(dayOfYear).padStart(4, '0')}</Text>
        <Text style={styles.kicker}>JOURNAL DE BORD</Text>
        <Text style={styles.date}>{dayLabel}</Text>
        {reviewed ? (
          <View style={[styles.stateChip, { borderColor: COLORS.amber }]}>
            <Text style={[styles.stateText, { color: COLORS.amber }]}>SCEAU APPOSÉ</Text>
          </View>
        ) : (
          <View style={[styles.stateChip, { borderColor: COLORS.orange }]}>
            <Text style={[styles.stateText, { color: COLORS.orange }]}>BILAN EN COURS</Text>
          </View>
        )}
      </View>

      {/* Cible */}
      <View style={styles.cibleCard}>
        <Text style={styles.cibleNum}>I — CIBLE</Text>
        <Text style={styles.cibleText}>{entry.cible || '—'}</Text>
      </View>

      {/* Score (only if reviewed) */}
      {reviewed && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>SCORE</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.radarRow}>
              <PentagonRadar score={score} size={160} showLabels showCenter />
              <View style={styles.scoreMeta}>
                <Text style={[styles.interpLabel, { color: iColor }]}>{iLabel}</Text>
                <Text style={styles.scoreNum}>{score.total}<Text style={styles.scoreMax}>/10</Text></Text>
              </View>
            </View>
            <View style={styles.sep} />
            <ScoreBreakdown score={score} />
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>CONTENU</Text>
        </View>
        <View style={styles.cardBody}>
          <Row label="II — Activité dominante" value={entry.activiteDominante} />
          <View style={styles.sep} />
          <Row label="IV — Antidote" value={entry.antidote} />
          <View style={styles.sep} />
          <Row label="VI — Énergie" value={entry.energie >= 0 ? `${entry.energie}/4` : '—'} />
          <View style={styles.sep} />
          <Row label="VIII — Champ d'influence" value={entry.champInfluence} />
          <View style={styles.sep} />
          <Row label="XI — Verbe" value={entry.verbe} />
        </View>
      </View>

      {/* Lists */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>VOIES & RITES</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.listLabel}>III — VOIES</Text>
          {(entry.voies || []).length === 0 ? (
            <Text style={styles.emptyList}>—</Text>
          ) : (
            entry.voies.map((v, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.listDot, reviewed && { backgroundColor: COLORS.amber }]} />
                <Text style={styles.listText}>{v}</Text>
              </View>
            ))
          )}

          <View style={styles.sep} />
          <Text style={styles.listLabel}>V — RITES</Text>
          {(entry.rites || []).length === 0 ? (
            <Text style={styles.emptyList}>—</Text>
          ) : (
            entry.rites.map((r, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.listDot, reviewed && { backgroundColor: COLORS.amber }]} />
                <Text style={styles.listText}>{r}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Dérive & Maîtrise */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>DISCIPLINE</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.listLabel}>VII — LIMITATIONS</Text>
          {(entry.limitations || []).length === 0 ? (
            <Text style={styles.emptyList}>Aucune</Text>
          ) : (
            entry.limitations.map((l, i) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.listDot} />
                <Text style={styles.listText}>{l}</Text>
              </View>
            ))
          )}
          {(entry.derives || []).length > 0 && (
            <>
              <View style={styles.sep} />
              <Text style={[styles.listLabel, { color: COLORS.ember }]}>DÉRIVES CONSTATÉES</Text>
              {entry.derives.map((d, i) => (
                <View key={i} style={styles.listItem}>
                  <View style={[styles.listDot, { backgroundColor: COLORS.ember }]} />
                  <Text style={[styles.listText, { color: COLORS.ember }]}>{d}</Text>
                </View>
              ))}
            </>
          )}
          <View style={styles.sep} />
          <Row
            label="X — Maîtrise"
            value={entry.integrityKept ? '✓ Intégrité tenue' : '✗ Non tenue'}
          />
        </View>
      </View>

      {/* Spectres */}
      {(entry.spectres || []).length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>IX — SPECTRES</Text>
          </View>
          <View style={styles.cardBody}>
            {entry.spectres.map((s, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.listDot, { backgroundColor: COLORS.blueDim }]} />
                <Text style={styles.listText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
  content: { paddingBottom: SPACING.xxl },
  back: {
    paddingHorizontal: SPACING.md,
    paddingTop: 56,
    paddingBottom: SPACING.sm,
  },
  backText: {
    fontFamily: FONTS.bodyMed,
    fontSize: 14,
    color: COLORS.amber,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.creamMuted },
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inkBorder,
    gap: 6,
  },
  serial: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.creamMuted,
    letterSpacing: 1,
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.amberDim,
    letterSpacing: 2,
  },
  date: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.cream,
    marginTop: 2,
  },
  stateChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  stateText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 1,
  },
  cibleCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    marginBottom: SPACING.sm,
  },
  cibleNum: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.amberDim,
    letterSpacing: 1,
    marginBottom: 4,
  },
  cibleText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 18,
    color: COLORS.cream,
    lineHeight: 26,
  },
  card: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inkBorder,
  },
  cardTitle: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.amber,
    letterSpacing: 2,
  },
  cardBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  radarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  scoreMeta: { flex: 1, gap: 6 },
  interpLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 15,
  },
  scoreNum: {
    fontFamily: FONTS.monoBold,
    fontSize: 36,
    color: COLORS.cream,
    lineHeight: 40,
  },
  scoreMax: {
    fontSize: 16,
    color: COLORS.creamMuted,
  },
  sep: {
    height: 1,
    backgroundColor: COLORS.inkBorder,
    marginVertical: SPACING.xs,
  },
  dataRow: {
    gap: 4,
  },
  dataLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.amberDim,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dataVal: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.cream,
    lineHeight: 20,
  },
  listLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.amberDim,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  listDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.creamMuted,
    marginTop: 7,
  },
  listText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.cream,
    flex: 1,
    lineHeight: 20,
  },
  emptyList: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.creamMuted,
    fontStyle: 'italic',
  },
});
