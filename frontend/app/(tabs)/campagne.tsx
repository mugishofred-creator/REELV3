import React, { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { ProgressBar } from "../../src/components/ProgressBar";
import { EmptyState } from "../../src/components/EmptyState";
import { Badge } from "../../src/components/Badge";
import { colors, radius, shadow } from "../../src/theme/colors";
import { platformColor, platformInitials } from "../../src/utils/format";
import { isAIReady } from "../../src/utils/ai";

export default function CampagneScreen() {
  const router = useRouter();
  const {
    profile,
    applications,
    campaign,
    updateCampaign,
    markSent,
    deleteApplication,
    ai,
    cvs,
  } = useData();
  const [, force] = useState(0);

  const queue = useMemo(
    () => applications.filter((a) => a.status === "file"),
    [applications]
  );

  const ready =
    !!profile.fullName &&
    !!profile.headline &&
    !!profile.email &&
    cvs.length > 0;

  const remaining = Math.max(0, campaign.dailyLimit - campaign.sentToday);
  const progress = campaign.sentToday / Math.max(1, campaign.dailyLimit);

  const next = queue[0];

  const launchNext = async () => {
    if (!ready) {
      Alert.alert(
        "Profil incomplet",
        "Renseigne tes infos de base, email, et importe au moins un CV avant de lancer la campagne."
      );
      return;
    }
    if (!next) return;
    if (remaining <= 0) {
      Alert.alert(
        "Limite atteinte",
        "Tu as atteint ta limite quotidienne. Reviens demain ou augmente la limite (attention au spam !)."
      );
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(next.offer.url);
    } catch {
      // ignored
    }
    Alert.alert(
      "Candidature envoyée ?",
      `Confirme l'envoi pour ${next.offer.company} — la file passe à la suivante.`,
      [
        { text: "Pas encore", style: "cancel" },
        {
          text: "Confirmer envoi",
          style: "default",
          onPress: () => {
            markSent(next.id);
            force((x) => x + 1);
          },
        },
      ]
    );
  };

  const toggleRunning = () => {
    if (!ready) {
      Alert.alert("Profil incomplet", "Complète ton profil avant de démarrer.");
      return;
    }
    updateCampaign({ running: !campaign.running });
  };

  const removeFromQueue = (id: string, label: string) => {
    Alert.alert("Retirer de la file", `Supprimer la candidature à ${label} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: () => deleteApplication(id),
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <ScreenHeader
        title="Campagne"
        subtitle={
          campaign.running
            ? "Moteur actif · qualité > volume"
            : "Moteur en veille"
        }
        right={
          <View style={styles.aiBadge}>
            <Ionicons
              name="sparkles"
              size={11}
              color={isAIReady(ai) ? colors.good : colors.textMuted}
            />
            <Text
              style={[
                styles.aiBadgeText,
                { color: isAIReady(ai) ? colors.good : colors.textMuted },
              ]}
            >
              {isAIReady(ai) ? "IA" : "OFF"}
            </Text>
          </View>
        }
      />

      <View style={styles.section}>
        <Card>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Moteur de campagne</Text>
              <Text style={styles.toggleSub}>
                Active pour activer les notifications de file et de relance.
              </Text>
            </View>
            <Switch
              value={campaign.running}
              onValueChange={toggleRunning}
              trackColor={{ false: colors.surfaceHigh, true: colors.goodBorder }}
              thumbColor={campaign.running ? colors.good : colors.textMuted}
            />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Quota du jour" subtitle="Pour rester crédible auprès des recruteurs" />
        <Card>
          <View style={styles.quotaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.quotaVal}>
                {campaign.sentToday}
                <Text style={styles.quotaDenom}> / {campaign.dailyLimit}</Text>
              </Text>
              <Text style={styles.quotaLabel}>envoyées aujourd'hui</Text>
            </View>
            <View style={styles.stepperWrap}>
              <TouchableOpacity
                style={styles.step}
                onPress={() =>
                  updateCampaign({ dailyLimit: Math.max(5, campaign.dailyLimit - 5) })
                }
              >
                <Ionicons name="remove" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.stepVal}>{campaign.dailyLimit}</Text>
              <TouchableOpacity
                style={styles.step}
                onPress={() =>
                  updateCampaign({ dailyLimit: Math.min(100, campaign.dailyLimit + 5) })
                }
              >
                <Ionicons name="add" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <ProgressBar progress={progress} color={colors.good} />
          </View>
          <Text style={styles.helper}>
            Recommandé : 15-25 candidatures qualifiées par jour. Au-delà, les recruteurs
            détectent les profils "auto-apply" et ignorent.
          </Text>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Prochaine cible" subtitle="1 tap pour postuler" />
        {next ? (
          <Card>
            <View style={styles.nextHeader}>
              <View
                style={[
                  styles.platChip,
                  {
                    backgroundColor: `${platformColor(next.offer.platform)}22`,
                    borderColor: `${platformColor(next.offer.platform)}55`,
                  },
                ]}
              >
                <Text style={[styles.platText, { color: platformColor(next.offer.platform) }]}>
                  {platformInitials(next.offer.platform)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextCompany}>{next.offer.company}</Text>
                <Text style={styles.nextTitle}>{next.offer.title}</Text>
              </View>
              {next.matchScore !== undefined && (
                <View style={styles.matchPill}>
                  <Text style={styles.matchPillText}>{next.matchScore}%</Text>
                </View>
              )}
            </View>

            {next.letterText ? (
              <View style={styles.letterBox}>
                <Text style={styles.letterLabel}>Lettre générée</Text>
                <Text style={styles.letterPreview} numberOfLines={4}>
                  {next.letterText}
                </Text>
              </View>
            ) : (
              <Text style={styles.helper}>
                Aucune lettre liée — depuis le détail tu peux en générer une.
              </Text>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.bigBtn, styles.bigBtnPrimary]}
                activeOpacity={0.85}
                onPress={launchNext}
              >
                <Ionicons name="rocket" size={16} color="#000" />
                <Text style={styles.bigBtnPrimaryText}>POSTULER MAINTENANT</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.subActionsRow}>
              <TouchableOpacity
                style={styles.subBtn}
                onPress={() =>
                  router.push({
                    pathname: "/application-detail",
                    params: { id: next.id },
                  })
                }
              >
                <Ionicons name="eye-outline" size={14} color={colors.textPrimary} />
                <Text style={styles.subBtnText}>Détail</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subBtn}
                onPress={() => removeFromQueue(next.id, next.offer.company)}
              >
                <Ionicons name="close-outline" size={14} color={colors.urgent} />
                <Text style={[styles.subBtnText, { color: colors.urgent }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <EmptyState
            icon="layers-outline"
            title="File vide"
            subtitle="Va dans Offres, ajoute les offres pertinentes — JobPilot s'occupe du reste."
          >
            <TouchableOpacity
              style={styles.fillBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/offres")}
            >
              <Text style={styles.fillBtnText}>Remplir la file</Text>
            </TouchableOpacity>
          </EmptyState>
        )}
      </View>

      {queue.length > 1 && (
        <View style={styles.section}>
          <SectionTitle title={`File d'attente · ${queue.length - 1}`} />
          <Card style={{ paddingVertical: 4 }}>
            {queue.slice(1, 10).map((a, idx, arr) => (
              <TouchableOpacity
                key={a.id}
                onPress={() =>
                  router.push({
                    pathname: "/application-detail",
                    params: { id: a.id },
                  })
                }
                style={[
                  styles.queueRow,
                  idx === arr.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View
                  style={[
                    styles.platDot,
                    { backgroundColor: platformColor(a.offer.platform) },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueTitle} numberOfLines={1}>
                    {a.offer.title}
                  </Text>
                  <Text style={styles.queueSub} numberOfLines={1}>
                    {a.offer.company} · {a.offer.platform}
                  </Text>
                </View>
                {a.matchScore !== undefined && (
                  <Badge label={`${a.matchScore}%`} tone={a.matchScore >= 70 ? "good" : "warning"} />
                )}
              </TouchableOpacity>
            ))}
            {queue.length > 10 && (
              <Text style={styles.queueMore}>+ {queue.length - 10} autres en file</Text>
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 4 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  toggleSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  quotaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quotaVal: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  quotaDenom: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  quotaLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  stepVal: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    minWidth: 24,
    textAlign: "center",
  },
  helper: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 12,
  },
  nextHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  platChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  platText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  nextCompany: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nextTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  matchPill: {
    backgroundColor: colors.goodBg,
    borderColor: colors.goodBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  matchPillText: {
    color: colors.good,
    fontSize: 12,
    fontWeight: "900",
  },
  letterBox: {
    backgroundColor: "#0A0A0A",
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: 14,
  },
  letterLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  letterPreview: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  actionsRow: { flexDirection: "row", gap: 8 },
  bigBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  bigBtnPrimary: {
    backgroundColor: colors.good,
    ...shadow.glow,
  },
  bigBtnPrimaryText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  subActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  subBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  fillBtn: {
    backgroundColor: colors.good,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  fillBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  platDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  queueTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  queueSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  queueMore: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 10,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
