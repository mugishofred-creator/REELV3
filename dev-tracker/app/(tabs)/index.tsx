import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { TextField } from '../../src/components/TextField';
import { ListEditor } from '../../src/components/ListEditor';
import { Segmented } from '../../src/components/Segmented';
import { Checkbox } from '../../src/components/Checkbox';
import { HeroCard } from '../../src/components/HeroCard';
import { ScoreBreakdown } from '../../src/components/ScoreBreakdown';
import {
  getEntry, saveEntry, emptyEntry, getAllEntries,
} from '../../src/lib/store';
import {
  scoreDay, defaultPhase, todayKey, isReviewed,
  interpLabel, interpColor, calcStreak, calcTotalXP, calcLevel,
} from '../../src/lib/scoring';
import { DayEntry, Phase } from '../../src/lib/types';

const ENERGY_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

function ModeBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.modeBtn, active && styles.modeBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const today = todayKey();
  const [entry, setEntry] = useState<DayEntry>(emptyEntry(today));
  const [phase, setPhase] = useState<Phase>(defaultPhase());
  const [saving, setSaving] = useState(false);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [allEntries, setAllEntries] = useState<Record<string, DayEntry>>({});

  async function load() {
    const e = await getEntry(today);
    const all = await getAllEntries();
    setAllEntries(all);
    if (e) setEntry(e);
    const s = calcStreak(all);
    const xp = calcTotalXP(all);
    const { level: lv } = calcLevel(xp);
    setStreak(s);
    setLevel(lv);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function update(key: keyof DayEntry, value: unknown) {
    setEntry(prev => ({ ...prev, [key]: value }));
  }

  async function savePlan() {
    setSaving(true);
    await saveEntry({ ...entry, updatedAt: Date.now() });
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Plan sauvegardé', 'Ton plan du jour est enregistré. Reviens ce soir pour sceller le bilan.');
  }

  async function sealBilan() {
    Alert.alert(
      'Sceller le bilan',
      'Es-tu sûr d\'avoir complété tous les champs ? Une fois scellé, le bilan compte dans ta série.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Apposer le sceau',
          style: 'default',
          onPress: async () => {
            const sealed = { ...entry, reviewedAt: Date.now(), updatedAt: Date.now() };
            setSaving(true);
            await saveEntry(sealed);
            setEntry(sealed);
            // refresh stats
            const all = await getAllEntries();
            setAllEntries(all);
            const s = calcStreak(all);
            const xp = calcTotalXP(all);
            const { level: lv } = calcLevel(xp);
            setStreak(s);
            setLevel(lv);
            setSaving(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Sceau apposé ✦', 'Journée validée. Elle compte dans ta série et ton XP.');
          },
        },
      ]
    );
  }

  const score = scoreDay(entry);
  const validated = isReviewed(entry);
  const iLabel = interpLabel(score.total);
  const iColor = interpColor(score.total);

  const planFilled = [
    entry.cible?.trim() ? 1 : 0,
    entry.activiteDominante?.trim() ? 1 : 0,
    (entry.voies || []).some(v => v?.trim()) ? 1 : 0,
    (entry.rites || []).some(r => r?.trim()) ? 1 : 0,
  ].reduce((a, b) => a + b, 0) / 4;

  const heroFragments = {
    mission: score.mission,
    voies: score.voies,
    rites: score.rites,
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <ModeBtn label="PLAN" active={phase === 'plan'} onPress={() => setPhase('plan')} />
        <ModeBtn label="BILAN" active={phase === 'review'} onPress={() => setPhase('review')} />
      </View>

      {/* Hero card */}
      {phase === 'plan' ? (
        <HeroCard
          mode="plan"
          date={today}
          cible={entry.cible}
          level={level}
          streak={streak}
          filled={planFilled}
          fragments={heroFragments}
        />
      ) : (
        <HeroCard
          mode="review"
          date={today}
          cible={entry.cible}
          score={score}
          level={level}
          streak={streak}
          interpLabel={iLabel}
          interpColor={iColor}
          validated={validated}
        />
      )}

      {/* ── PLAN FIELDS ─────────────────────────────── */}

      {/* I — Cible */}
      <Card number="I" title="Cible">
        <TextField
          placeholder="Quelle est ta cible principale du jour ?"
          value={entry.cible}
          onChangeText={v => update('cible', v)}
          multiline
        />
      </Card>

      {/* II — Activité dominante */}
      <Card number="II" title="Activité dominante">
        <TextField
          placeholder="La tâche principale qui fait avancer la cible..."
          value={entry.activiteDominante}
          onChangeText={v => update('activiteDominante', v)}
          multiline
        />
      </Card>

      {/* III — Voies */}
      <Card number="III" title="Voies">
        <Text style={styles.cardHint}>Les actions clés à accomplir aujourd'hui</Text>
        <ListEditor
          items={entry.voies}
          checked={entry.voies.map((_, i) => false)}
          onChange={v => update('voies', v)}
          hideToggle={phase === 'plan'}
          onToggle={() => {}}
          placeholder="Ajouter une voie..."
        />
      </Card>

      {/* IV — Antidote */}
      <Card number="IV" title="Antidote">
        <TextField
          placeholder="Contre quoi te bats-tu ? Quel est ton remède ?"
          value={entry.antidote}
          onChangeText={v => update('antidote', v)}
          multiline
        />
      </Card>

      {/* V — Rites */}
      <Card number="V" title="Rites">
        <Text style={styles.cardHint}>Habitudes incontournables du jour</Text>
        <ListEditor
          items={entry.rites}
          checked={entry.rites.map(() => false)}
          onChange={v => update('rites', v)}
          hideToggle={phase === 'plan'}
          onToggle={() => {}}
          placeholder="Ajouter un rite..."
        />
      </Card>

      {/* VI — Corps & énergie */}
      <Card number="VI" title="Corps & Énergie">
        <Segmented
          label="Niveau d'énergie (0 = épuisé · 4 = optimal)"
          options={ENERGY_OPTIONS}
          value={entry.energie === -1 ? -1 : entry.energie}
          onChange={v => update('energie', v)}
        />
      </Card>

      {/* VII — Dérives */}
      <Card number="VII" title="Dérives">
        <Text style={styles.cardHint}>Limitations que tu t'es fixées</Text>
        <ListEditor
          items={entry.limitations}
          onChange={v => update('limitations', v)}
          hideToggle
          placeholder="Ajouter une limitation..."
        />
        {phase === 'review' && (
          <>
            <Text style={[styles.cardHint, { marginTop: SPACING.sm, color: COLORS.orange }]}>
              As-tu dérivé aujourd'hui ?
            </Text>
            <ListEditor
              items={entry.derives}
              onChange={v => update('derives', v)}
              hideToggle
              placeholder="Ajouter une dérive..."
            />
          </>
        )}
      </Card>

      {/* VIII — Champ d'influence */}
      <Card number="VIII" title="Champ d'influence">
        <TextField
          placeholder="Sur quoi as-tu le contrôle aujourd'hui ?"
          value={entry.champInfluence}
          onChangeText={v => update('champInfluence', v)}
          multiline
        />
      </Card>

      {/* IX — Spectres */}
      <Card number="IX" title="Spectres">
        <Text style={styles.cardHint}>Peurs, doutes ou résistances à nommer</Text>
        <ListEditor
          items={entry.spectres}
          onChange={v => update('spectres', v)}
          hideToggle
          placeholder="Nommer un spectre..."
        />
      </Card>

      {/* X — Maîtrise (bilan only) */}
      {phase === 'review' && (
        <Card number="X" title="Maîtrise">
          <Checkbox
            label="J'ai tenu mes engagements avec intégrité aujourd'hui"
            checked={entry.integrityKept}
            onToggle={() => update('integrityKept', !entry.integrityKept)}
          />
        </Card>
      )}

      {/* XI — Verbe */}
      <Card number="XI" title="Verbe">
        <TextField
          placeholder="Une phrase / affirmation / intention pour demain..."
          value={entry.verbe}
          onChangeText={v => update('verbe', v)}
          multiline
        />
      </Card>

      {/* Score preview (bilan mode) */}
      {phase === 'review' && (
        <Card title="Score du jour">
          <ScoreBreakdown score={score} />
          {!validated && (
            <Text style={styles.provisoireWarn}>
              Score provisoire — scelle le bilan pour valider
            </Text>
          )}
        </Card>
      )}

      {/* CTA */}
      <View style={styles.ctaRow}>
        {phase === 'plan' ? (
          <TouchableOpacity
            style={[styles.cta, styles.ctaBlue]}
            onPress={savePlan}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.cream} />
            ) : (
              <Text style={styles.ctaText}>Sauvegarder le plan</Text>
            )}
          </TouchableOpacity>
        ) : validated ? (
          <View style={[styles.cta, styles.ctaSealed]}>
            <Text style={styles.ctaText}>✦ Sceau apposé</Text>
          </View>
        ) : (
          <View style={{ gap: SPACING.sm, flex: 1 }}>
            <TouchableOpacity
              style={[styles.cta, styles.ctaAmber]}
              onPress={sealBilan}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.ink} />
              ) : (
                <Text style={[styles.ctaText, { color: COLORS.ink }]}>Sceller le bilan</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cta, styles.ctaGhost]}
              onPress={savePlan}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaText, { color: COLORS.creamMuted }]}>Sauvegarder (brouillon)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
  content: { padding: SPACING.md, paddingTop: 56 },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.inkMid,
    borderRadius: RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  modeBtnActive: {
    backgroundColor: COLORS.amberGlow,
    borderWidth: 1,
    borderColor: COLORS.amberDim,
  },
  modeBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.creamMuted,
    letterSpacing: 1.5,
  },
  modeBtnTextActive: { color: COLORS.amber },
  cardHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.creamMuted,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  provisoireWarn: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.orange,
    textAlign: 'center',
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
  ctaRow: { marginTop: SPACING.sm, marginBottom: SPACING.xxl },
  cta: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBlue: {
    backgroundColor: COLORS.blue,
  },
  ctaAmber: {
    backgroundColor: COLORS.amber,
  },
  ctaSealed: {
    backgroundColor: COLORS.amberGlow,
    borderWidth: 1,
    borderColor: COLORS.amberDim,
  },
  ctaGhost: {
    backgroundColor: COLORS.inkSurface,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
  },
  ctaText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.cream,
    letterSpacing: 0.5,
  },
});
