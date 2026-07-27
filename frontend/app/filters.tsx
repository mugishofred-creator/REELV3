import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card, SectionTitle } from "../src/components/Card";
import { Input } from "../src/components/Input";
import { Chip } from "../src/components/Chip";
import { useData, type ContractType, type RemoteMode, type Platform } from "../src/store/context";
import { colors, radius, shadow } from "../src/theme/colors";
import { ALL_CONTRACTS, ALL_PLATFORMS, ALL_REMOTE, platformColor } from "../src/utils/format";

export default function FiltersScreen() {
  const router = useRouter();
  const { filters, updateFilters, resetFilters } = useData();
  const [draft, setDraft] = useState({ ...filters });

  const toggleArray = <T extends string>(
    arr: T[],
    val: T,
    setter: (next: T[]) => void
  ) => {
    if (arr.includes(val)) {
      setter(arr.filter((x) => x !== val));
    } else {
      setter([...arr, val]);
    }
  };

  const apply = () => {
    updateFilters(draft);
    router.back();
  };

  const reset = () => {
    resetFilters();
    router.back();
  };

  return (
    <ModalScreen title="Filtres" subtitle="Cible précise = meilleures réponses">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
        <Card>
          <SectionTitle title="Recherche" />
          <Input
            label="Mots-clés"
            placeholder="ex: react, python, growth"
            value={draft.keywords}
            onChangeText={(t) => setDraft((d) => ({ ...d, keywords: t }))}
          />
          <Input
            label="Localisation"
            placeholder="ex: Paris, Lyon, France"
            value={draft.location}
            onChangeText={(t) => setDraft((d) => ({ ...d, location: t }))}
          />
          <Input
            label="Salaire minimum (€/an ou €/mois)"
            placeholder="ex: 35000"
            keyboardType="numeric"
            value={draft.salaryMin ? String(draft.salaryMin) : ""}
            onChangeText={(t) =>
              setDraft((d) => ({ ...d, salaryMin: parseInt(t, 10) || 0 }))
            }
          />
        </Card>

        <Card>
          <SectionTitle title="Type de contrat" />
          <View style={styles.chipRow}>
            {ALL_CONTRACTS.map((c) => (
              <Chip
                key={c}
                label={c}
                active={draft.contracts.includes(c)}
                onPress={() =>
                  toggleArray<ContractType>(
                    draft.contracts,
                    c,
                    (next) => setDraft((d) => ({ ...d, contracts: next }))
                  )
                }
              />
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Mode de travail" />
          <View style={styles.chipRow}>
            {ALL_REMOTE.map((r) => (
              <Chip
                key={r}
                label={r}
                active={draft.remote.includes(r)}
                onPress={() =>
                  toggleArray<RemoteMode>(
                    draft.remote,
                    r,
                    (next) => setDraft((d) => ({ ...d, remote: next }))
                  )
                }
              />
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Plateformes" />
          <View style={styles.chipRow}>
            {ALL_PLATFORMS.map((p) => (
              <Chip
                key={p}
                label={p}
                active={draft.platforms.includes(p)}
                color={platformColor(p)}
                onPress={() =>
                  toggleArray<Platform>(
                    draft.platforms,
                    p,
                    (next) => setDraft((d) => ({ ...d, platforms: next }))
                  )
                }
              />
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Qualité" subtitle="Évite le spam et les fausses offres" />
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() =>
              setDraft((d) => ({ ...d, excludeFakeOffers: !d.excludeFakeOffers }))
            }
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Filtrer les fausses offres</Text>
              <Text style={styles.toggleSub}>
                Exclut MLM, arnaques, "argent facile"
              </Text>
            </View>
            <View
              style={[
                styles.checkBox,
                draft.excludeFakeOffers && styles.checkBoxOn,
              ]}
            >
              {draft.excludeFakeOffers && (
                <Ionicons name="checkmark" size={14} color="#000" />
              )}
            </View>
          </TouchableOpacity>

          <View style={{ marginTop: 14 }}>
            <Text style={styles.label}>Score minimum de match</Text>
            <View style={styles.scoreRow}>
              {[0, 40, 60, 75, 85].map((v) => (
                <Chip
                  key={v}
                  label={v === 0 ? "Tous" : `${v}+`}
                  active={draft.minMatchScore === v}
                  onPress={() => setDraft((d) => ({ ...d, minMatchScore: v }))}
                />
              ))}
            </View>
          </View>
        </Card>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={reset}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={14} color={colors.urgent} />
            <Text style={styles.resetText}>RÉINITIALISER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={apply}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={15} color="#000" />
            <Text style={styles.applyText}>APPLIQUER</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  toggleTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: {
    backgroundColor: colors.good,
    borderColor: colors.good,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  scoreRow: { flexDirection: "row", gap: 6 },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.urgentBorder,
    backgroundColor: colors.urgentBg,
  },
  resetText: {
    color: colors.urgent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  applyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.good,
    ...shadow.glow,
  },
  applyText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
