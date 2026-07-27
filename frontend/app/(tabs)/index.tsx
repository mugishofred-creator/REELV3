import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StatCard } from "../../src/components/StatCard";
import { Card, SectionTitle } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { ProgressBar } from "../../src/components/ProgressBar";
import { colors, radius, shadow } from "../../src/theme/colors";
import { daysUntil, statusLabel, statusTone, timeAgoISO } from "../../src/utils/format";
import { isAIReady, strategicAdviceAI, type StrategicAdvice } from "../../src/utils/ai";

export default function Dashboard() {
  const router = useRouter();
  const { profile, applications, campaign, ai, cvs, letters } = useData();
  const [advice, setAdvice] = useState<StrategicAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  const stats = useMemo(() => {
    const envoyees = applications.filter((a) => a.status !== "file");
    const enFile = applications.filter((a) => a.status === "file");
    const entretiens = applications.filter(
      (a) => a.status === "entretien" || a.status === "offre"
    );
    const vues = applications.filter((a) => a.status !== "file" && a.status !== "envoyee");
    const responseRate =
      envoyees.length > 0
        ? Math.round((vues.length / envoyees.length) * 100)
        : 0;
    const today = new Date().toISOString().slice(0, 10);
    const sentToday = applications.filter(
      (a) => a.sentAt && a.sentAt.slice(0, 10) === today
    ).length;
    const followUpsDue = applications.filter((a) => {
      if (!a.nextFollowUp || a.followUpSent) return false;
      const d = daysUntil(a.nextFollowUp);
      return d !== null && d <= 0;
    });
    return {
      total: applications.length,
      enFile: enFile.length,
      envoyees: envoyees.length,
      entretiens: entretiens.length,
      responseRate,
      sentToday,
      followUpsDue,
    };
  }, [applications]);

  const recent = useMemo(
    () =>
      [...applications]
        .sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, 4),
    [applications]
  );

  const profileComplete = !!profile.fullName && !!profile.headline;
  const onboardingMissing = [
    !profileComplete && { label: "Complète ton profil", route: "/profile-edit" as const },
    cvs.length === 0 && { label: "Importe un CV", route: "/profil" as const },
    letters.length === 0 && { label: "Crée une lettre type", route: "/letter-editor" as const },
    !ai.apiKey && {
      label: "Active l'IA (OpenAI)",
      route: "/ai-settings" as const,
    },
  ].filter(Boolean) as { label: string; route: "/profile-edit" | "/profil" | "/letter-editor" | "/ai-settings" }[];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const runAdvice = async () => {
    if (!isAIReady(ai)) {
      Alert.alert("IA désactivée", "Configure ta clé OpenAI dans Profil → IA pour activer les conseils stratégiques.");
      return;
    }
    if (applications.length < 3) {
      Alert.alert("Pas assez de data", "Postule à au moins 3 offres pour activer l'analyse stratégique.");
      return;
    }
    setAdviceLoading(true);
    try {
      const res = await strategicAdviceAI(ai, profile, applications);
      setAdvice(res);
    } catch (e: any) {
      Alert.alert("IA indisponible", e?.message ?? "Réessaie plus tard.");
    } finally {
      setAdviceLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <ScreenHeader
        title={profile.fullName ? `${greeting}, ${profile.fullName.split(" ")[0]}` : "Pilote"}
        subtitle={
          profile.headline
            ? `Mission : décrocher un poste de ${profile.headline}`
            : "Mission : décrocher ton prochain poste"
        }
        right={
          <TouchableOpacity
            style={styles.aiBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/ai-settings")}
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={isAIReady(ai) ? colors.good : colors.textMuted}
            />
            <Text
              style={[
                styles.aiBtnText,
                { color: isAIReady(ai) ? colors.good : colors.textMuted },
              ]}
            >
              {isAIReady(ai) ? "IA ON" : "IA"}
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.section}>
        {onboardingMissing.length > 0 && (
          <Card accent="warning" style={{ marginBottom: 14 }}>
            <Text style={styles.cardTitle}>Setup en {onboardingMissing.length} étape{onboardingMissing.length > 1 ? "s" : ""}</Text>
            <Text style={styles.cardSub}>
              Termine la config pour que JobPilot puisse postuler à ta place.
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {onboardingMissing.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.setupRow}
                  onPress={() => router.push(m.route)}
                  activeOpacity={0.85}
                >
                  <View style={styles.setupDot} />
                  <Text style={styles.setupText}>{m.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        <View style={styles.grid}>
          <StatCard
            label="Total candidatures"
            value={String(stats.total)}
            hint={stats.enFile > 0 ? `${stats.enFile} en file` : "—"}
            tone="neutral"
          />
          <StatCard
            label="Envoyées"
            value={String(stats.envoyees)}
            hint={`${stats.sentToday} aujourd'hui`}
            tone="good"
          />
        </View>
        <View style={[styles.grid, { marginTop: 10 }]}>
          <StatCard
            label="Entretiens"
            value={String(stats.entretiens)}
            hint={stats.entretiens > 0 ? "Closing zone" : "Vise +1 cette semaine"}
            tone="warning"
          />
          <StatCard
            label="Taux de réponse"
            value={`${stats.responseRate}%`}
            hint={
              stats.responseRate >= 25
                ? "Au-dessus de la moyenne"
                : "Pousser la qualité"
            }
            tone={stats.responseRate >= 25 ? "good" : "neutral"}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Campagne du jour" subtitle="Limite quotidienne anti-spam" />
        <Card>
          <View style={styles.campaignRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.campaignVal}>
                {campaign.sentToday}
                <Text style={styles.campaignDenom}> / {campaign.dailyLimit}</Text>
              </Text>
              <Text style={styles.campaignLabel}>Candidatures envoyées</Text>
            </View>
            <TouchableOpacity
              style={styles.runBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/campagne")}
            >
              <Ionicons name="flash" size={14} color="#000" />
              <Text style={styles.runBtnText}>LANCER</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressBar
              progress={campaign.sentToday / Math.max(1, campaign.dailyLimit)}
              color={colors.good}
            />
          </View>
          {stats.enFile > 0 ? (
            <Text style={styles.queueHint}>
              {stats.enFile} offre{stats.enFile > 1 ? "s" : ""} en file d'attente
            </Text>
          ) : (
            <Text style={styles.queueHint}>
              Ajoute des offres depuis l'onglet Offres pour remplir la file.
            </Text>
          )}
        </Card>
      </View>

      {stats.followUpsDue.length > 0 && (
        <View style={styles.section}>
          <SectionTitle
            title="Relances dues"
            subtitle="Augmente ton taux de réponse de 15 à 30 %"
          />
          <Card accent="warning">
            <Text style={styles.cardTitle}>
              {stats.followUpsDue.length} relance{stats.followUpsDue.length > 1 ? "s" : ""} à envoyer
            </Text>
            {stats.followUpsDue.slice(0, 3).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.recentRow}
                onPress={() =>
                  router.push({
                    pathname: "/application-detail",
                    params: { id: a.id },
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle}>{a.offer.title}</Text>
                  <Text style={styles.recentSub}>
                    {a.offer.company} · envoyée {timeAgoISO(a.sentAt)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      )}

      <View style={styles.section}>
        <SectionTitle title="Conseil stratégique IA" subtitle="Apprentissage basé sur tes résultats" />
        <Card>
          {advice ? (
            <>
              <Text style={styles.adviceHeadline}>{advice.headline}</Text>
              {advice.insights.length > 0 && (
                <>
                  <Text style={styles.adviceLabel}>Insights</Text>
                  {advice.insights.map((it, i) => (
                    <Text key={i} style={styles.adviceItem}>• {it}</Text>
                  ))}
                </>
              )}
              {advice.nextActions.length > 0 && (
                <>
                  <Text style={[styles.adviceLabel, { marginTop: 10 }]}>Actions</Text>
                  {advice.nextActions.map((it, i) => (
                    <Text key={i} style={[styles.adviceItem, { color: colors.good }]}>→ {it}</Text>
                  ))}
                </>
              )}
            </>
          ) : (
            <Text style={styles.adviceMuted}>
              Lance une analyse IA pour identifier où concentrer tes efforts.
            </Text>
          )}
          <TouchableOpacity
            style={styles.adviceBtn}
            activeOpacity={0.85}
            onPress={runAdvice}
            disabled={adviceLoading}
          >
            <Ionicons name="sparkles" size={14} color={colors.good} />
            <Text style={styles.adviceBtnText}>
              {adviceLoading ? "Analyse en cours…" : advice ? "Relancer l'analyse" : "Analyser ma stratégie"}
            </Text>
          </TouchableOpacity>
        </Card>
      </View>

      {recent.length > 0 && (
        <View style={styles.section}>
          <SectionTitle title="Activité récente" />
          <Card style={{ paddingVertical: 4 }}>
            {recent.map((a, idx) => (
              <TouchableOpacity
                key={a.id}
                onPress={() =>
                  router.push({
                    pathname: "/application-detail",
                    params: { id: a.id },
                  })
                }
                style={[styles.recentRow, idx === recent.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle}>{a.offer.title}</Text>
                  <Text style={styles.recentSub}>{a.offer.company} · {timeAgoISO(a.updatedAt)}</Text>
                </View>
                <Badge label={statusLabel(a.status)} tone={statusTone(a.status)} />
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 4 },
  grid: { flexDirection: "row", gap: 10 },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  cardSub: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  setupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,170,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,170,0,0.15)",
  },
  setupDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  setupText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  campaignRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  campaignVal: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
  },
  campaignDenom: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
  },
  campaignLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.good,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...shadow.glow,
  },
  runBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  queueHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 10,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  recentTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  recentSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  adviceMuted: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  adviceHeadline: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  adviceLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 4,
  },
  adviceItem: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginVertical: 1,
  },
  adviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
  },
  adviceBtnText: {
    color: colors.good,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 4,
  },
  aiBtnText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
