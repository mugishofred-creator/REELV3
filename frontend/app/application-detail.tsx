import React, { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card, SectionTitle } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { Chip } from "../src/components/Chip";
import { useData, type AppStatus } from "../src/store/context";
import { colors, radius, shadow } from "../src/theme/colors";
import {
  daysUntil,
  platformColor,
  platformInitials,
  statusLabel,
  statusTone,
  timeAgoISO,
} from "../src/utils/format";

const STATUSES: AppStatus[] = ["file", "envoyee", "vue", "entretien", "offre", "refus"];

export default function ApplicationDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    applications,
    updateApplication,
    deleteApplication,
    setStatus,
    markSent,
  } = useData();

  const app = useMemo(
    () => applications.find((a) => a.id === id),
    [applications, id]
  );

  const [notesDraft, setNotesDraft] = useState(app?.notes ?? "");

  if (!app) {
    return (
      <ModalScreen title="Candidature introuvable">
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.textMuted }}>Cette candidature n'existe plus.</Text>
        </View>
      </ModalScreen>
    );
  }

  const pColor = platformColor(app.offer.platform);
  const fuDays = app.nextFollowUp ? daysUntil(app.nextFollowUp) : null;

  const saveNotes = () => {
    updateApplication(app.id, { notes: notesDraft });
  };

  const confirmDelete = () => {
    Alert.alert("Supprimer", "Retirer cette candidature de ton suivi ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          deleteApplication(app.id);
          router.back();
        },
      },
    ]);
  };

  const openOffer = async () => {
    try {
      await WebBrowser.openBrowserAsync(app.offer.url);
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir l'offre.");
    }
  };

  const markFollowUpSent = () => {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    updateApplication(app.id, {
      followUpSent: true,
      nextFollowUp: next.toISOString(),
    });
  };

  return (
    <ModalScreen title={app.offer.title} subtitle={`${app.offer.company} · ${app.offer.location}`}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
        <Card>
          <View style={styles.topRow}>
            <View
              style={[
                styles.platBox,
                { borderColor: `${pColor}55`, backgroundColor: `${pColor}22` },
              ]}
            >
              <Text style={[styles.platText, { color: pColor }]}>
                {platformInitials(app.offer.platform)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Statut</Text>
              <Badge label={statusLabel(app.status)} tone={statusTone(app.status)} />
            </View>
            {app.matchScore !== undefined && (
              <View style={styles.matchPill}>
                <Text style={styles.matchVal}>{app.matchScore}%</Text>
                <Text style={styles.matchLbl}>MATCH</Text>
              </View>
            )}
          </View>

          <View style={styles.statusRow}>
            {STATUSES.map((s) => (
              <Chip
                key={s}
                label={statusLabel(s)}
                active={app.status === s}
                onPress={() => setStatus(app.id, s)}
                size="sm"
              />
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Timeline" />
          <View style={styles.timelineRow}>
            <Text style={styles.tlLabel}>Créée</Text>
            <Text style={styles.tlValue}>{timeAgoISO(app.createdAt)}</Text>
          </View>
          {app.sentAt && (
            <View style={styles.timelineRow}>
              <Text style={styles.tlLabel}>Envoyée</Text>
              <Text style={styles.tlValue}>{timeAgoISO(app.sentAt)}</Text>
            </View>
          )}
          {app.responseAt && (
            <View style={styles.timelineRow}>
              <Text style={styles.tlLabel}>1ère réponse</Text>
              <Text style={styles.tlValue}>{timeAgoISO(app.responseAt)}</Text>
            </View>
          )}
          {app.nextFollowUp && fuDays !== null && (
            <View style={styles.timelineRow}>
              <Text style={styles.tlLabel}>Prochaine relance</Text>
              <Text
                style={[
                  styles.tlValue,
                  fuDays <= 0 && { color: colors.warning },
                ]}
              >
                {fuDays <= 0
                  ? "Aujourd'hui"
                  : fuDays === 1
                  ? "Demain"
                  : `Dans ${fuDays} j`}
              </Text>
            </View>
          )}
        </Card>

        {(app.aiReasons?.length ?? 0) > 0 && (
          <Card accent="good">
            <SectionTitle title="Pourquoi tu as candidaté" />
            {app.aiReasons!.map((r, i) => (
              <Text key={i} style={styles.reason}>✓ {r}</Text>
            ))}
          </Card>
        )}

        {(app.aiRedFlags?.length ?? 0) > 0 && (
          <Card accent="warning">
            <SectionTitle title="Points de vigilance" />
            {app.aiRedFlags!.map((r, i) => (
              <Text key={i} style={styles.flag}>⚠ {r}</Text>
            ))}
          </Card>
        )}

        {app.letterText && (
          <Card>
            <SectionTitle title="Lettre envoyée" />
            <View style={styles.letterBox}>
              <Text style={styles.letterText}>{app.letterText}</Text>
            </View>
          </Card>
        )}

        <Card>
          <SectionTitle title="Notes perso" />
          <TextInput
            value={notesDraft}
            onChangeText={setNotesDraft}
            onBlur={saveNotes}
            multiline
            placeholder="Recruteur rencontré, retours, prochaines étapes…"
            placeholderTextColor={colors.textMuted}
            style={styles.notesInput}
          />
        </Card>

        <View style={styles.actionsCol}>
          {app.status === "file" && (
            <TouchableOpacity
              style={[styles.bigBtn, styles.bigBtnPrimary]}
              onPress={() => {
                markSent(app.id);
                openOffer();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="rocket" size={15} color="#000" />
              <Text style={styles.bigBtnPrimaryText}>POSTULER ET MARQUER ENVOYÉE</Text>
            </TouchableOpacity>
          )}

          {app.nextFollowUp && fuDays !== null && fuDays <= 0 && !app.followUpSent && (
            <TouchableOpacity
              style={[styles.bigBtn, styles.bigBtnWarning]}
              onPress={markFollowUpSent}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane-outline" size={15} color={colors.warning} />
              <Text style={styles.bigBtnWarningText}>RELANCE ENVOYÉE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.bigBtn, styles.bigBtnSecondary]}
            onPress={openOffer}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={15} color={colors.textPrimary} />
            <Text style={styles.bigBtnSecondaryText}>Rouvrir l'offre</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bigBtn, styles.bigBtnDanger]}
            onPress={confirmDelete}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={14} color={colors.urgent} />
            <Text style={styles.bigBtnDangerText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  platBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  platText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  matchPill: {
    backgroundColor: colors.goodBg,
    borderColor: colors.goodBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: "center",
  },
  matchVal: {
    color: colors.good,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  matchLbl: {
    color: colors.good,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: -2,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  tlLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  tlValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  reason: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  flag: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  letterBox: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 4,
  },
  letterText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  notesInput: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.textPrimary,
    fontSize: 13,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    lineHeight: 18,
    marginTop: 4,
  },
  actionsCol: {
    gap: 8,
  },
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  bigBtnPrimary: {
    backgroundColor: colors.good,
    ...shadow.glow,
  },
  bigBtnPrimaryText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  bigBtnSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigBtnSecondaryText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  bigBtnWarning: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  bigBtnWarningText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bigBtnDanger: {
    backgroundColor: colors.urgentBg,
    borderWidth: 1,
    borderColor: colors.urgentBorder,
  },
  bigBtnDangerText: {
    color: colors.urgent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
