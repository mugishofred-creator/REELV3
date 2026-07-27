import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ModalScreen } from "../src/components/ModalScreen";
import { Input } from "../src/components/Input";
import { Card, SectionTitle } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { useData, type ContractType, type RemoteMode } from "../src/store/context";
import { colors, radius, shadow } from "../src/theme/colors";
import { ALL_CONTRACTS, ALL_REMOTE } from "../src/utils/format";

export default function ProfileEdit() {
  const router = useRouter();
  const { profile, updateProfile } = useData();
  const [draft, setDraft] = useState({ ...profile });
  const [skillInput, setSkillInput] = useState("");

  const set = <K extends keyof typeof draft>(key: K, val: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v) return;
    if (draft.skills.includes(v)) {
      setSkillInput("");
      return;
    }
    set("skills", [...draft.skills, v]);
    setSkillInput("");
  };

  const removeSkill = (s: string) =>
    set("skills", draft.skills.filter((x) => x !== s));

  const toggleContract = (c: ContractType) => {
    if (draft.preferredContracts.includes(c)) {
      set(
        "preferredContracts",
        draft.preferredContracts.filter((x) => x !== c)
      );
    } else {
      set("preferredContracts", [...draft.preferredContracts, c]);
    }
  };

  const toggleRemote = (r: RemoteMode) => {
    if (draft.preferredRemote.includes(r)) {
      set("preferredRemote", draft.preferredRemote.filter((x) => x !== r));
    } else {
      set("preferredRemote", [...draft.preferredRemote, r]);
    }
  };

  const save = () => {
    updateProfile(draft);
    router.back();
  };

  return (
    <ModalScreen title="Profil" subtitle="Plus c'est précis, mieux JobPilot cible">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
        <Card>
          <SectionTitle title="Identité" />
          <Input
            label="Nom complet"
            placeholder="ex: Camille Martin"
            value={draft.fullName}
            onChangeText={(t) => set("fullName", t)}
          />
          <Input
            label="Poste cible"
            placeholder="ex: Développeur Full-Stack Junior"
            value={draft.headline}
            onChangeText={(t) => set("headline", t)}
          />
          <Input
            label="Email"
            placeholder="ex: camille@mail.com"
            value={draft.email}
            onChangeText={(t) => set("email", t)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="Téléphone"
            placeholder="ex: 06 12 34 56 78"
            value={draft.phone}
            onChangeText={(t) => set("phone", t)}
            keyboardType="phone-pad"
          />
          <Input
            label="Ville"
            placeholder="ex: Paris"
            value={draft.city}
            onChangeText={(t) => set("city", t)}
          />
          <Input
            label="LinkedIn"
            placeholder="https://linkedin.com/in/..."
            value={draft.linkedin}
            onChangeText={(t) => set("linkedin", t)}
            autoCapitalize="none"
          />
          <Input
            label="Portfolio / GitHub"
            placeholder="https://..."
            value={draft.portfolio}
            onChangeText={(t) => set("portfolio", t)}
            autoCapitalize="none"
          />
        </Card>

        <Card>
          <SectionTitle title="Pitch" subtitle="2-3 lignes que l'IA reprend dans les lettres" />
          <TextInput
            value={draft.summary}
            onChangeText={(t) => set("summary", t)}
            multiline
            placeholder="Ce que tu apportes en quelques lignes."
            placeholderTextColor={colors.textMuted}
            style={styles.textarea}
          />
        </Card>

        <Card>
          <SectionTitle title="Compétences" />
          <View style={styles.skillInputRow}>
            <TextInput
              value={skillInput}
              onChangeText={setSkillInput}
              onSubmitEditing={addSkill}
              placeholder="Ajouter une compétence"
              placeholderTextColor={colors.textMuted}
              style={styles.skillInput}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addSkillBtn} onPress={addSkill}>
              <Ionicons name="add" size={16} color={colors.good} />
            </TouchableOpacity>
          </View>
          {draft.skills.length > 0 && (
            <View style={styles.skillRow}>
              {draft.skills.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.skillChip}
                  onPress={() => removeSkill(s)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.skillText}>{s}</Text>
                  <Ionicons name="close" size={11} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        <Card>
          <SectionTitle title="Parcours" />
          <Input
            label="Niveau d'études"
            placeholder="ex: Bac+3, Master 2..."
            value={draft.educationLevel}
            onChangeText={(t) => set("educationLevel", t)}
          />
          <Input
            label="Années d'expérience"
            placeholder="ex: 2"
            value={draft.experienceYears > 0 ? String(draft.experienceYears) : ""}
            onChangeText={(t) =>
              set("experienceYears", parseInt(t, 10) || 0)
            }
            keyboardType="numeric"
          />
          <Input
            label="Salaire minimum visé (€/an)"
            placeholder="ex: 35000"
            value={draft.salaryMin > 0 ? String(draft.salaryMin) : ""}
            onChangeText={(t) => set("salaryMin", parseInt(t, 10) || 0)}
            keyboardType="numeric"
          />
        </Card>

        <Card>
          <SectionTitle title="Préférences" />
          <Text style={styles.label}>Type de contrat</Text>
          <View style={styles.chipRow}>
            {ALL_CONTRACTS.map((c) => (
              <Chip
                key={c}
                label={c}
                active={draft.preferredContracts.includes(c)}
                onPress={() => toggleContract(c)}
              />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 12 }]}>Mode de travail</Text>
          <View style={styles.chipRow}>
            {ALL_REMOTE.map((r) => (
              <Chip
                key={r}
                label={r}
                active={draft.preferredRemote.includes(r)}
                onPress={() => toggleRemote(r)}
              />
            ))}
          </View>
        </Card>

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={15} color="#000" />
          <Text style={styles.saveText}>ENREGISTRER</Text>
        </TouchableOpacity>
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  textarea: {
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
  },
  skillInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  skillInput: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addSkillBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.goodBg,
    borderWidth: 1,
    borderColor: colors.goodBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  skillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  skillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
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
