import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAllEntries } from '../../src/lib/store';
import { scoreDay, isReviewed, parseDateKey, interpLabel, interpColor } from '../../src/lib/scoring';
import { DayEntry } from '../../src/lib/types';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/lib/theme';

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

interface EntryRow {
  date: string;
  entry?: DayEntry;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [validatedCount, setValidatedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await getAllEntries();
        // Build last 90 days
        const result: EntryRow[] = [];
        for (let i = 0; i < 90; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          result.push({ date: key, entry: all[key] });
        }
        setRows(result);
        const validated = Object.values(all).filter(isReviewed).length;
        const draft = Object.values(all).filter(e => !isReviewed(e)).length;
        setValidatedCount(validated);
        setDraftCount(draft);
      })();
    }, [])
  );

  function renderItem({ item }: { item: EntryRow }) {
    const dt = parseDateKey(item.date);
    const dayLabel = DAYS_FR[dt.getDay()];
    const dayNum = dt.getDate();
    const monthLabel = MONTHS_FR[dt.getMonth()];

    let stateColor: string = COLORS.inkBorder;
    let stateLabel: string = '—';
    let score: string | null = null;
    let iLabel: string | null = null;
    let iColor: string = COLORS.creamMuted;

    if (item.entry) {
      if (isReviewed(item.entry)) {
        const s = scoreDay(item.entry);
        score = String(s.total);
        iLabel = interpLabel(s.total);
        iColor = interpColor(s.total);
        stateColor = COLORS.amber;
        stateLabel = 'VALIDÉ';
      } else {
        stateColor = COLORS.orange;
        stateLabel = 'BROUILLON';
      }
    }

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/day/${item.date}` as any)}
        activeOpacity={0.75}
      >
        {/* Date block */}
        <View style={styles.dateBlock}>
          <Text style={styles.dayLabel}>{dayLabel}</Text>
          <Text style={styles.dayNum}>{dayNum}</Text>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </View>

        {/* State bar */}
        <View style={[styles.stateDot, { backgroundColor: stateColor }]} />

        {/* Content */}
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.cibleText} numberOfLines={1}>
              {item.entry?.cible || '—'}
            </Text>
            {score !== null && (
              <Text style={[styles.scoreChip, { color: iColor }]}>{score}/10</Text>
            )}
          </View>
          <View style={styles.rowBottom}>
            <View style={[styles.stateChip, { borderColor: stateColor }]}>
              <Text style={[styles.stateText, { color: stateColor }]}>{stateLabel}</Text>
            </View>
            {iLabel && (
              <Text style={[styles.interpText, { color: iColor }]}>{iLabel}</Text>
            )}
          </View>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>ARCHIVES</Text>
        <Text style={styles.subtitle}>
          {validatedCount} validés · {draftCount} brouillons
        </Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => r.date}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: 56,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inkBorder,
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
  list: { paddingVertical: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sep: {
    height: 1,
    backgroundColor: COLORS.inkBorder,
    marginHorizontal: SPACING.md,
  },
  dateBlock: {
    width: 40,
    alignItems: 'center',
  },
  dayLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.creamMuted,
    textTransform: 'uppercase',
  },
  dayNum: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    color: COLORS.cream,
    lineHeight: 24,
  },
  monthLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.creamMuted,
  },
  stateDot: {
    width: 3,
    height: 40,
    borderRadius: 999,
    marginHorizontal: 4,
  },
  rowContent: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cibleText: {
    fontFamily: FONTS.bodyMed,
    fontSize: 14,
    color: COLORS.cream,
    flex: 1,
  },
  scoreChip: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    marginLeft: SPACING.sm,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stateChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  stateText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  interpText: {
    fontFamily: FONTS.body,
    fontSize: 11,
  },
  arrow: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.creamMuted,
  },
});
