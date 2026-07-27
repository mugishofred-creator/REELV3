import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { EmptyState } from "../../src/components/EmptyState";
import { colors, radius, shadow } from "../../src/theme/colors";
import { isAIReady, optimizeCVAI, type CVOptimization } from "../../src/utils/ai";
import { previewLetter } from "../../src/utils/letter";

export default function ProfilScreen() {
  const router = useRouter();
  const {
    profile,
    ai,
    cvs,
    letters,
    addCV,
    deleteCV,
    setDefaultCV,
    deleteLetter,
    setDefaultLetter,
    resetAll,
  } = useData();
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<CVOptimization | null>(null);

  const pickCV = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const file = res.assets[0];
      addCV({
        name: file.name ?? "CV",
        uri: file.uri,
        size: file.size,
      });
    } catch (e: any) {
      Alert.alert("Import échoué", e?.message ?? "Réessaie.");
    }
  };

  const confirmDeleteCV = (id: string, name: string) => {
    Alert.alert("Supprimer ce CV", name, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteCV(id) },
    ]);
  };

  const optimizeCV = async () => {
    if (!isAIReady(ai)) {
      Alert.alert("IA désactivée", "Renseigne ta clé OpenAI dans Réglages IA.");
      return;
    }
    const cv = cvs.find((c) => c.isDefault) ?? cvs[0];
    if (!cv) {
      Alert.alert("Aucun CV", "Importe d'abord un CV.");
      return;
    }
    if (!cv.rawText || cv.rawText.length < 60) {
      Alert.alert(
        "Texte du CV requis",
        "Pour l'analyse ATS, ajoute le texte brut du CV (depuis Modifier ce CV)."
      );
      return;
    }
    setOptimizing(true);
    setOptimization(null);
    try {
      const res = await optimizeCVAI(ai, profile, cv.rawText);
      setOptimization(res);
    } catch (e: any) {
      Alert.alert("IA indisponible", e?.message ?? "Réessaie plus tard.");
    } finally {
      setOptimizing(false);
    }
  };

  const profileComplete = !!profile.fullName && !!profile.headline && !!profile.email;

  const confirmReset = () => {
    Alert.alert(
      "Tout réinitialiser",
      "Supprimer profil, CVs, lettres, candidatures ? Action irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout effacer",
          style: "destructive",
          onPress: resetAll,
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <ScreenHeader
        title="Profil"
        subtitle={profileComplete ? "Identité candidat" : "Termine ton profil pour activer le moteur"}
        right={
          <TouchableOpacity
            style={styles.aiBtn}
            onPress={() => router.push("/ai-settings")}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={14} color={isAIReady(ai) ? colors.good : colors.textMuted} />
            <Text style={[styles.aiBtnText, { color: isAIReady(ai) ? colors.good : colors.textMuted }]}>
              IA
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.section}>
        <Card>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.fullName
                  ? profile.fullName
                      .split(" ")
                      .map((s) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullName}>
                {profile.fullName || "Profil non renseigné"}
              </Text>
              <Text style={styles.headline}>
                {profile.headline || "Poste cible — à renseigner"}
              </Text>
              {profile.city ? (
                <Text style={styles.muted}>📍 {profile.city}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push("/profile-edit")}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {profile.skills.length > 0 && (
            <View style={styles.skillsRow}>
              {profile.skills.slice(0, 8).map((s) => (
                <View key={s} style={styles.skillPill}>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
              {profile.skills.length > 8 && (
                <Text style={styles.muted}>+{profile.skills.length - 8}</Text>
              )}
            </View>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle title={`CV · ${cvs.length}`} subtitle="Le CV par défaut sera utilisé en campagne" />
        {cvs.length === 0 ? (
          <Card>
            <EmptyState
              icon="document-text-outline"
              title="Aucun CV importé"
              subtitle="Importe ton CV PDF pour activer les candidatures."
            />
            <TouchableOpacity style={styles.fullBtn} onPress={pickCV} activeOpacity={0.85}>
              <Ionicons name="cloud-upload-outline" size={16} color="#000" />
              <Text style={styles.fullBtnText}>IMPORTER UN CV</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <>
            {cvs.map((cv) => (
              <Card key={cv.id} style={{ marginBottom: 8 }}>
                <View style={styles.cvRow}>
                  <View style={styles.cvIcon}>
                    <Ionicons name="document-text" size={20} color={colors.good} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cvName} numberOfLines={1}>
                      {cv.name}
                    </Text>
                    <Text style={styles.muted}>
                      {cv.size ? `${Math.round(cv.size / 1024)} ko · ` : ""}
                      {new Date(cv.addedAt).toLocaleDateString("fr-FR")}
                    </Text>
                  </View>
                  {cv.isDefault ? (
                    <Badge label="Défaut" tone="good" />
                  ) : (
                    <TouchableOpacity onPress={() => setDefaultCV(cv.id)}>
                      <Text style={styles.linkBtn}>Définir défaut</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => confirmDeleteCV(cv.id, cv.name)}>
                    <Ionicons name="trash-outline" size={16} color={colors.urgent} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
            <View style={styles.dualRow}>
              <TouchableOpacity style={styles.halfBtn} onPress={pickCV} activeOpacity={0.85}>
                <Ionicons name="add" size={14} color={colors.textPrimary} />
                <Text style={styles.halfBtnText}>Ajouter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.halfBtn, styles.halfBtnAccent]}
                onPress={optimizeCV}
                activeOpacity={0.85}
                disabled={optimizing}
              >
                <Ionicons name="sparkles" size={14} color={colors.good} />
                <Text style={[styles.halfBtnText, { color: colors.good }]}>
                  {optimizing ? "Analyse…" : "Optimiser ATS"}
                </Text>
              </TouchableOpacity>
            </View>

            {optimization && (
              <Card accent="info" style={{ marginTop: 10 }}>
                <Text style={styles.optTitle}>
                  Score ATS : <Text style={{ color: colors.good }}>{optimization.atsScore}/100</Text>
                </Text>
                {optimization.strengths.length > 0 && (
                  <>
                    <Text style={styles.optLabel}>Points forts</Text>
                    {optimization.strengths.map((s, i) => (
                      <Text key={i} style={styles.optItem}>✓ {s}</Text>
                    ))}
                  </>
                )}
                {optimization.improvements.length > 0 && (
                  <>
                    <Text style={styles.optLabel}>À améliorer</Text>
                    {optimization.improvements.map((s, i) => (
                      <Text key={i} style={[styles.optItem, { color: colors.warning }]}>→ {s}</Text>
                    ))}
                  </>
                )}
                {optimization.missingKeywords.length > 0 && (
                  <>
                    <Text style={styles.optLabel}>Mots-clés manquants</Text>
                    <View style={styles.kwRow}>
                      {optimization.missingKeywords.map((k) => (
                        <View key={k} style={styles.kwPill}>
                          <Text style={styles.kwText}>{k}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </Card>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle title={`Lettres de motivation · ${letters.length}`} subtitle="Templates avec variables {{poste}}, {{entreprise}}…" />
        {letters.length === 0 ? (
          <Card>
            <EmptyState
              icon="mail-outline"
              title="Aucune lettre"
              subtitle="Crée un template ou laisse l'IA générer une lettre par offre."
            />
            <TouchableOpacity
              style={styles.fullBtn}
              onPress={() => router.push("/letter-editor")}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#000" />
              <Text style={styles.fullBtnText}>CRÉER UNE LETTRE</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <>
            {letters.map((l) => (
              <Card key={l.id} style={{ marginBottom: 8 }}>
                <View style={styles.letterTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.letterName}>{l.name}</Text>
                    <Text style={styles.letterPrev} numberOfLines={2}>
                      {previewLetter(l.body)}
                    </Text>
                  </View>
                  {l.isDefault && <Badge label="Défaut" tone="good" />}
                </View>
                <View style={styles.letterActions}>
                  <TouchableOpacity
                    style={styles.letterBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/letter-editor",
                        params: { id: l.id },
                      })
                    }
                  >
                    <Ionicons name="create-outline" size={13} color={colors.textPrimary} />
                    <Text style={styles.letterBtnText}>Éditer</Text>
                  </TouchableOpacity>
                  {!l.isDefault && (
                    <TouchableOpacity style={styles.letterBtn} onPress={() => setDefaultLetter(l.id)}>
                      <Ionicons name="star-outline" size={13} color={colors.textPrimary} />
                      <Text style={styles.letterBtnText}>Définir défaut</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.letterBtn, { borderColor: colors.urgentBorder }]}
                    onPress={() =>
                      Alert.alert("Supprimer", l.name, [
                        { text: "Annuler", style: "cancel" },
                        { text: "Supprimer", style: "destructive", onPress: () => deleteLetter(l.id) },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.urgent} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
            <TouchableOpacity
              style={styles.fullBtn}
              onPress={() => router.push("/letter-editor")}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#000" />
              <Text style={styles.fullBtnText}>NOUVELLE LETTRE</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle title="Paramètres" />
        <Card>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/ai-settings")}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.good} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Intelligence Artificielle</Text>
              <Text style={styles.settingSub}>
                {isAIReady(ai) ? `Activée · ${ai.model}` : "Non configurée"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={confirmReset}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={18} color={colors.urgent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.urgent }]}>
                Tout réinitialiser
              </Text>
              <Text style={styles.settingSub}>Supprime profil, CVs, lettres, candidatures.</Text>
            </View>
          </TouchableOpacity>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 4 },
  identityRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.good,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  fullName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  headline: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
    alignItems: "center",
  },
  skillPill: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  skillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  cvRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cvIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cvName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  linkBtn: {
    color: colors.info,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.good,
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: 12,
    ...shadow.glow,
  },
  fullBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  dualRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  halfBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  halfBtnAccent: {
    backgroundColor: colors.goodBg,
    borderColor: colors.goodBorder,
  },
  halfBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  optTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  optLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  optItem: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  kwRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  kwPill: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  kwText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },
  letterTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  letterName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  letterPrev: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    marginTop: 4,
  },
  letterActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  letterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  letterBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  settingTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  settingSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 6,
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
