import React, { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import { useData } from "../src/store/context";
import { colors, radius, shadow } from "../src/theme/colors";
import {
  formatSalary,
  platformColor,
  platformInitials,
  remoteIcon,
  timeAgo,
} from "../src/utils/format";
import { scoreColor, scoreOfferHeuristic } from "../src/utils/match";
import { getSeedOffers } from "../src/utils/seed";
import {
  generateLetterAI,
  isAIReady,
  scoreOfferAI,
  detectFakeOfferAI,
  type AIOfferScore,
  type FakeOfferAnalysis,
} from "../src/utils/ai";
import {
  DEFAULT_LETTER_TEMPLATE,
  pickDefaultLetter,
  renderLetter,
} from "../src/utils/letter";

export default function OfferDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    profile,
    filters,
    letters,
    cvs,
    ai,
    addApplication,
    isQueuedOrApplied,
  } = useData();

  const offer = useMemo(
    () => getSeedOffers().find((o) => o.id === id),
    [id]
  );

  const heuristic = useMemo(
    () => (offer ? scoreOfferHeuristic(offer, profile, filters) : null),
    [offer, profile, filters]
  );

  const [aiScore, setAiScore] = useState<AIOfferScore | null>(null);
  const [aiScoreLoading, setAiScoreLoading] = useState(false);
  const [fake, setFake] = useState<FakeOfferAnalysis | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [letterLoading, setLetterLoading] = useState(false);

  if (!offer) {
    return (
      <ModalScreen title="Offre introuvable">
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.textMuted }}>Cette offre n'existe plus.</Text>
        </View>
      </ModalScreen>
    );
  }

  const pColor = platformColor(offer.platform);
  const score = aiScore?.score ?? heuristic?.score ?? 0;
  const reasons = aiScore?.reasons ?? heuristic?.reasons ?? [];
  const redFlags = [
    ...(aiScore?.redFlags ?? heuristic?.redFlags ?? []),
    ...(fake?.isFake && fake.confidence > 0.5 ? fake.reasons : []),
  ];
  const tone = scoreColor(score);
  const scoreAccent =
    tone === "good" ? colors.good
    : tone === "warning" ? colors.warning
    : colors.urgent;

  const queued = isQueuedOrApplied(offer.id);

  const runAIScore = async () => {
    if (!isAIReady(ai)) {
      Alert.alert("IA désactivée", "Renseigne ta clé OpenAI dans Profil → IA.");
      return;
    }
    setAiScoreLoading(true);
    try {
      const [s, f] = await Promise.all([
        scoreOfferAI(ai, profile, offer),
        detectFakeOfferAI(ai, offer),
      ]);
      setAiScore(s);
      setFake(f);
    } catch (e: any) {
      Alert.alert("IA indisponible", e?.message ?? "Réessaie plus tard.");
    } finally {
      setAiScoreLoading(false);
    }
  };

  const runGenerateLetter = async () => {
    if (!isAIReady(ai)) {
      const tpl = pickDefaultLetter(letters.length ? letters : [DEFAULT_LETTER_TEMPLATE]);
      setLetter(renderLetter(tpl.body, offer, profile));
      return;
    }
    setLetterLoading(true);
    try {
      const tpl = letters.find((l) => l.isDefault) ?? letters[0];
      const out = await generateLetterAI(ai, profile, offer, tpl?.body);
      setLetter(out);
    } catch (e: any) {
      Alert.alert("IA indisponible", e?.message ?? "Réessaie plus tard.");
    } finally {
      setLetterLoading(false);
    }
  };

  const enqueue = () => {
    if (queued) return;
    const tpl = pickDefaultLetter(letters.length ? letters : [DEFAULT_LETTER_TEMPLATE]);
    const letterText = letter ?? renderLetter(tpl.body, offer, profile);
    addApplication({
      offer,
      cvId: cvs.find((c) => c.isDefault)?.id ?? cvs[0]?.id,
      letterId: tpl.id === "default" ? undefined : tpl.id,
      letterText,
      matchScore: score,
      aiReasons: reasons,
      aiRedFlags: redFlags,
    });
    Alert.alert("Ajoutée", `${offer.title} a rejoint ta file.`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const openOffer = async () => {
    try {
      await WebBrowser.openBrowserAsync(offer.url);
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir l'offre.");
    }
  };

  return (
    <ModalScreen title={offer.title} subtitle={`${offer.company} · ${offer.location}`}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
        <Card>
          <View style={styles.topRow}>
            <View
              style={[
                styles.platBox,
                { borderColor: `${pColor}55`, backgroundColor: `${pColor}22` },
              ]}
            >
              <Text style={[styles.platText, { color: pColor }]}>
                {platformInitials(offer.platform)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.platformName}>{offer.platform}</Text>
              <Text style={styles.muted}>{timeAgo(offer.postedDaysAgo)}</Text>
            </View>
            <View
              style={[
                styles.scoreBig,
                { borderColor: `${scoreAccent}55`, backgroundColor: `${scoreAccent}1A` },
              ]}
            >
              <Text style={[styles.scoreBigVal, { color: scoreAccent }]}>{score}</Text>
              <Text style={[styles.scoreBigLbl, { color: scoreAccent }]}>MATCH</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Ionicons name="briefcase-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaLabel}>Contrat</Text>
              <Text style={styles.metaVal}>{offer.contract}</Text>
            </View>
            <View style={styles.metaCell}>
              <Ionicons
                name={remoteIcon(offer.remote) as React.ComponentProps<typeof Ionicons>["name"]}
                size={14}
                color={colors.textMuted}
              />
              <Text style={styles.metaLabel}>Mode</Text>
              <Text style={styles.metaVal}>{offer.remote}</Text>
            </View>
            <View style={styles.metaCell}>
              <Ionicons name="cash-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaLabel}>Salaire</Text>
              <Text style={[styles.metaVal, { color: colors.good }]}>
                {formatSalary(offer.salaryMin, offer.salaryMax)}
              </Text>
            </View>
          </View>
        </Card>

        {reasons.length > 0 && (
          <Card accent="good">
            <Text style={styles.sectionTitle}>Pourquoi ce match</Text>
            {reasons.map((r, i) => (
              <Text key={i} style={styles.reason}>✓ {r}</Text>
            ))}
            {aiScore?.fitSummary && (
              <Text style={styles.fitSummary}>{aiScore.fitSummary}</Text>
            )}
          </Card>
        )}

        {redFlags.length > 0 && (
          <Card accent="urgent">
            <Text style={styles.sectionTitle}>Vigilance</Text>
            {redFlags.map((r, i) => (
              <Text key={i} style={styles.flag}>⚠ {r}</Text>
            ))}
            {fake?.isFake && fake.confidence > 0.7 && (
              <Text style={styles.fakeBanner}>
                Confiance IA fausse offre : {Math.round(fake.confidence * 100)}%
              </Text>
            )}
          </Card>
        )}

        <Card>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{offer.description}</Text>
          {offer.skills.length > 0 && (
            <View style={styles.skillsBlock}>
              <Text style={styles.label}>Compétences attendues</Text>
              <View style={styles.skillsRow}>
                {offer.skills.map((s) => (
                  <Badge key={s} label={s} tone="info" />
                ))}
              </View>
            </View>
          )}
        </Card>

        <Card>
          <View style={styles.letterHeader}>
            <Text style={styles.sectionTitle}>Lettre de motivation</Text>
            <TouchableOpacity
              style={styles.aiPill}
              onPress={runGenerateLetter}
              disabled={letterLoading}
              activeOpacity={0.85}
            >
              {letterLoading ? (
                <ActivityIndicator size="small" color={colors.good} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={12} color={colors.good} />
                  <Text style={styles.aiPillText}>
                    {isAIReady(ai) ? "Générer (IA)" : "Générer"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {letter ? (
            <View style={styles.letterBox}>
              <Text style={styles.letterText}>{letter}</Text>
            </View>
          ) : (
            <Text style={styles.muted}>
              {isAIReady(ai)
                ? "Touche Générer pour produire une lettre personnalisée par IA."
                : "Sans IA, on utilise ton template défaut avec les placeholders remplacés."}
            </Text>
          )}
        </Card>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.bigBtn, styles.bigBtnSecondary]}
            onPress={openOffer}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={15} color={colors.textPrimary} />
            <Text style={styles.bigBtnSecondaryText}>Voir l'offre</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.bigBtn,
              queued ? styles.bigBtnDone : styles.bigBtnPrimary,
            ]}
            onPress={enqueue}
            disabled={queued}
            activeOpacity={0.85}
          >
            <Ionicons
              name={queued ? "checkmark-circle" : "add"}
              size={15}
              color={queued ? colors.textPrimary : "#000"}
            />
            <Text
              style={[
                queued ? styles.bigBtnDoneText : styles.bigBtnPrimaryText,
              ]}
            >
              {queued ? "Dans la file" : "Ajouter à la file"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.bigBtn, styles.bigBtnGhost]}
          onPress={runAIScore}
          disabled={aiScoreLoading}
          activeOpacity={0.85}
        >
          {aiScoreLoading ? (
            <ActivityIndicator color={colors.good} />
          ) : (
            <>
              <Ionicons name="sparkles" size={14} color={colors.good} />
              <Text style={styles.bigBtnGhostText}>
                {aiScore ? "Réanalyser avec IA" : "Analyser avec IA"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
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
  platformName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  scoreBig: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  scoreBigVal: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  scoreBigLbl: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: -3,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metaCell: {
    flex: 1,
    padding: 10,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    gap: 4,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metaVal: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  reason: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginVertical: 1,
  },
  fitSummary: {
    color: colors.good,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 17,
  },
  flag: {
    color: colors.urgent,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginVertical: 1,
  },
  fakeBanner: {
    color: colors.urgent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 8,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  skillsBlock: { marginTop: 12 },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  letterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  aiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goodBorder,
    backgroundColor: colors.goodBg,
  },
  aiPillText: {
    color: colors.good,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  letterBox: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: 12,
  },
  letterText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  bigBtn: {
    flex: 1,
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
    letterSpacing: 0.5,
  },
  bigBtnSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigBtnSecondaryText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bigBtnDone: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigBtnDoneText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bigBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.goodBorder,
  },
  bigBtnGhostText: {
    color: colors.good,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
