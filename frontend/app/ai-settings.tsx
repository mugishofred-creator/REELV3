import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card, SectionTitle } from "../src/components/Card";
import { Input } from "../src/components/Input";
import { Chip } from "../src/components/Chip";
import { useData } from "../src/store/context";
import { colors, radius, shadow } from "../src/theme/colors";

const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Rapide, économique — recommandé" },
  { id: "gpt-4o", label: "GPT-4o", desc: "Lettres premium, plus coûteux" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", desc: "Bonne polyvalence" },
];

export default function AISettings() {
  const router = useRouter();
  const { ai, updateAI } = useData();
  const [apiKey, setApiKey] = useState(ai.apiKey);
  const [model, setModel] = useState(ai.model);
  const [smart, setSmart] = useState(ai.smartMode);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);

  const save = () => {
    updateAI({ apiKey: apiKey.trim(), model, smartMode: smart });
    router.back();
  };

  const test = async () => {
    if (!apiKey.trim()) {
      Alert.alert("Clé manquante", "Renseigne ta clé OpenAI d'abord.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Réponds juste OK." }],
          max_tokens: 5,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} — ${txt.slice(0, 120)}`);
      }
      Alert.alert("Connexion OK", `Le modèle ${model} répond. Tu peux activer le mode IA.`);
    } catch (e: any) {
      Alert.alert("Échec du test", e?.message ?? "Vérifie ta clé et ta connexion.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <ModalScreen
      title="Intelligence Artificielle"
      subtitle="Apporte le scoring, les lettres sur-mesure et le coaching"
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
        <Card accent="info">
          <Text style={styles.heroTitle}>Mode Agent IA</Text>
          <Text style={styles.heroBody}>
            JobPilot utilise <Text style={{ fontWeight: "900", color: colors.good }}>OpenAI</Text> pour scorer
            chaque offre, détecter les fausses annonces, rédiger des lettres personnalisées et te donner des
            conseils stratégiques basés sur tes résultats.
          </Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Activer l'IA</Text>
              <Text style={styles.toggleSub}>
                {smart ? "Les fonctions IA sont actives" : "L'app fonctionne en mode heuristique"}
              </Text>
            </View>
            <Switch
              value={smart}
              onValueChange={setSmart}
              trackColor={{ false: colors.surfaceHigh, true: colors.goodBorder }}
              thumbColor={smart ? colors.good : colors.textMuted}
            />
          </View>
        </Card>

        <Card>
          <SectionTitle title="Clé API OpenAI" subtitle="Stockée localement sur ton appareil uniquement" />
          <Input
            label="API key"
            placeholder="sk-..."
            value={show ? apiKey : maskKey(apiKey)}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!show}
          />
          <View style={styles.miniRow}>
            <TouchableOpacity
              style={styles.miniBtn}
              onPress={() => setShow((s) => !s)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={show ? "eye-off-outline" : "eye-outline"}
                size={13}
                color={colors.textPrimary}
              />
              <Text style={styles.miniBtnText}>{show ? "Masquer" : "Afficher"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.miniBtn, { backgroundColor: colors.goodBg, borderColor: colors.goodBorder }]}
              onPress={test}
              disabled={testing}
              activeOpacity={0.85}
            >
              {testing ? (
                <ActivityIndicator size="small" color={colors.good} />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={13} color={colors.good} />
              )}
              <Text style={[styles.miniBtnText, { color: colors.good }]}>Tester</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helper}>
            Récupère une clé sur platform.openai.com → API keys. JobPilot ne l'envoie nulle part en dehors d'OpenAI.
          </Text>
        </Card>

        <Card>
          <SectionTitle title="Modèle" />
          <View style={{ gap: 6 }}>
            {MODELS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelRow, model === m.id && styles.modelRowActive]}
                onPress={() => setModel(m.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.radio, model === m.id && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modelLabel}>{m.label}</Text>
                  <Text style={styles.modelDesc}>{m.desc}</Text>
                </View>
                {m.id === "gpt-4o-mini" && <Chip label="Reco" active color={colors.good} size="sm" />}
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Capacités IA" />
          {[
            { icon: "speedometer-outline", title: "Scoring intelligent", desc: "Match profil ⇄ offre, raisons et red flags." },
            { icon: "mail-outline", title: "Lettre sur-mesure", desc: "Personnalisée par entreprise, pas de cliché." },
            { icon: "shield-checkmark-outline", title: "Détection fausses offres", desc: "Filtre MLM, arnaques, ghost jobs." },
            { icon: "trending-up-outline", title: "Coach stratégique", desc: "Recos basées sur ton taux de réponse." },
            { icon: "document-text-outline", title: "Optimisation CV ATS", desc: "Score ATS + mots-clés manquants." },
          ].map((c) => (
            <View key={c.title} style={styles.capRow}>
              <View style={styles.capIcon}>
                <Ionicons
                  name={c.icon as React.ComponentProps<typeof Ionicons>["name"]}
                  size={16}
                  color={colors.good}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.capTitle}>{c.title}</Text>
                <Text style={styles.capDesc}>{c.desc}</Text>
              </View>
            </View>
          ))}
        </Card>

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={15} color="#000" />
          <Text style={styles.saveText}>ENREGISTRER</Text>
        </TouchableOpacity>
      </ScrollView>
    </ModalScreen>
  );
}

function maskKey(k: string) {
  if (!k) return "";
  if (k.length <= 8) return k;
  return `${k.slice(0, 5)}••••••••${k.slice(-4)}`;
}

const styles = StyleSheet.create({
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  toggleTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
  },
  toggleSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  miniRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: -4,
    marginBottom: 8,
  },
  miniBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  miniBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelRowActive: {
    borderColor: colors.goodBorder,
    backgroundColor: colors.goodBg,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  radioOn: {
    borderColor: colors.good,
    backgroundColor: colors.good,
  },
  modelLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
  },
  modelDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  capRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  capIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  capTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
  },
  capDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.good,
    ...shadow.glow,
  },
  saveText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
