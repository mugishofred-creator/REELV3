import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/lib/theme';
import { exportToFile, importFromFile } from '../../src/lib/backup';
import { reloadStore } from '../../src/lib/store';

function SettingRow({
  label, sub, onPress, color,
}: { label: string; sub?: string; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, color ? { color } : {}]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);

  async function doExport() {
    if (busy) return;
    setBusy(true);
    try {
      await exportToFile();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible d\'exporter');
    } finally {
      setBusy(false);
    }
  }

  async function doImport(mode: 'merge' | 'replace') {
    if (busy) return;
    const msg = mode === 'replace'
      ? 'Cela écrasera TOUTES tes données actuelles. Es-tu sûr ?'
      : 'Le fichier sera fusionné avec tes données actuelles.';

    Alert.alert('Importer le codex', msg, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Continuer',
        style: mode === 'replace' ? 'destructive' : 'default',
        onPress: async () => {
          setBusy(true);
          try {
            const { count } = await importFromFile(mode);
            await reloadStore();
            Alert.alert('Import réussi', `${count} entrée(s) importée(s).`);
          } catch (e: any) {
            if (e.message !== 'Annulé') {
              Alert.alert('Erreur', e.message || 'Import impossible');
            }
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>PARAMÈTRES</Text>
      </View>

      {/* Backup section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SAUVEGARDE</Text>
        <View style={styles.card}>
          <SettingRow
            label="Exporter le codex"
            sub="Télécharge un fichier JSON de toutes tes entrées"
            onPress={doExport}
            color={COLORS.amber}
          />
          <View style={styles.sep} />
          <SettingRow
            label="Importer & fusionner"
            sub="Fusionne un fichier JSON avec tes données actuelles"
            onPress={() => doImport('merge')}
          />
          <View style={styles.sep} />
          <SettingRow
            label="Importer & remplacer"
            sub="Remplace toutes tes données par le fichier importé"
            onPress={() => doImport('replace')}
            color={COLORS.ember}
          />
        </View>
      </View>

      {/* About section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>À PROPOS</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Application</Text>
            <Text style={styles.aboutVal}>Codex</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutVal}>1.0.0</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Inspiré par</Text>
            <Text style={styles.aboutVal}>Napoleon Hill</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        "La discipline est le pont entre les objectifs et l'accomplissement."
      </Text>
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
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.cream,
    letterSpacing: 2,
  },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.creamMuted,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.inkBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  rowLabel: {
    fontFamily: FONTS.bodyMed,
    fontSize: 14,
    color: COLORS.cream,
  },
  rowSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.creamMuted,
    marginTop: 2,
  },
  arrow: {
    fontFamily: FONTS.body,
    fontSize: 18,
    color: COLORS.creamMuted,
  },
  sep: {
    height: 1,
    backgroundColor: COLORS.inkBorder,
    marginHorizontal: SPACING.md,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  aboutLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.creamMuted,
  },
  aboutVal: {
    fontFamily: FONTS.bodyMed,
    fontSize: 13,
    color: COLORS.cream,
  },
  footer: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.creamMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
});
