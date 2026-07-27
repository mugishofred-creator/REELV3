import React, { useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { OfferCard } from "../../src/components/OfferCard";
import { EmptyState } from "../../src/components/EmptyState";
import { SegmentedControl } from "../../src/components/SegmentedControl";
import { Chip } from "../../src/components/Chip";
import { colors, radius } from "../../src/theme/colors";
import { applyHardFilters, scoreOfferHeuristic } from "../../src/utils/match";
import { getSeedOffers } from "../../src/utils/seed";
import { renderLetter, pickDefaultLetter, DEFAULT_LETTER_TEMPLATE } from "../../src/utils/letter";

type SortMode = "match" | "recent" | "salary";

export default function OffresScreen() {
  const router = useRouter();
  const {
    profile,
    filters,
    letters,
    cvs,
    addApplication,
    isQueuedOrApplied,
  } = useData();
  const [sort, setSort] = useState<SortMode>("match");

  const offers = useMemo(() => getSeedOffers(), []);

  const filtered = useMemo(() => {
    const hardFiltered = applyHardFilters(offers, filters);
    const scored = hardFiltered.map((o) => ({
      offer: o,
      ...scoreOfferHeuristic(o, profile, filters),
    }));
    const above = scored.filter((s) => s.score >= filters.minMatchScore);
    if (sort === "match") {
      above.sort((a, b) => b.score - a.score);
    } else if (sort === "recent") {
      above.sort((a, b) => a.offer.postedDaysAgo - b.offer.postedDaysAgo);
    } else if (sort === "salary") {
      above.sort((a, b) => (b.offer.salaryMax ?? 0) - (a.offer.salaryMax ?? 0));
    }
    return above;
  }, [offers, profile, filters, sort]);

  const activeFilterCount =
    (filters.keywords ? 1 : 0) +
    (filters.location ? 1 : 0) +
    filters.contracts.length +
    filters.remote.length +
    filters.platforms.length +
    (filters.salaryMin > 0 ? 1 : 0) +
    (filters.minMatchScore > 0 ? 1 : 0);

  const enqueueOne = (offerId: string) => {
    const found = offers.find((o) => o.id === offerId);
    if (!found) return;
    if (isQueuedOrApplied(found.id)) return;
    const defaultLetter = pickDefaultLetter(letters.length ? letters : [DEFAULT_LETTER_TEMPLATE]);
    const letterText = renderLetter(defaultLetter.body, found, profile);
    const score = scoreOfferHeuristic(found, profile, filters);
    addApplication({
      offer: found,
      cvId: cvs.find((c) => c.isDefault)?.id ?? cvs[0]?.id,
      letterId: defaultLetter.id === "default" ? undefined : defaultLetter.id,
      letterText,
      matchScore: score.score,
      aiReasons: score.reasons,
      aiRedFlags: score.redFlags,
    });
  };

  const enqueueAll = () => {
    const eligible = filtered.filter((s) => !isQueuedOrApplied(s.offer.id));
    if (eligible.length === 0) {
      Alert.alert("Rien à ajouter", "Toutes les offres affichées sont déjà dans la file.");
      return;
    }
    Alert.alert(
      "Ajouter à la file",
      `Mettre ${eligible.length} offre${eligible.length > 1 ? "s" : ""} en file ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Ajouter",
          onPress: () => eligible.forEach((s) => enqueueOne(s.offer.id)),
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
        title="Offres"
        subtitle={`${filtered.length} sélectionnée${filtered.length > 1 ? "s" : ""} · ${offers.length} disponibles`}
        right={
          <TouchableOpacity
            style={styles.filterBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/filters")}
          >
            <Ionicons name="options-outline" size={14} color={colors.textPrimary} />
            <Text style={styles.filterBtnText}>FILTRES</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <SegmentedControl
          value={sort}
          onChange={setSort}
          options={[
            { label: "Match", value: "match" },
            { label: "Récentes", value: "recent" },
            { label: "Salaire", value: "salary" },
          ]}
        />
      </View>

      {filtered.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <Chip
            label={`+ Tout ajouter à la file (${filtered.filter((f) => !isQueuedOrApplied(f.offer.id)).length})`}
            active
            onPress={enqueueAll}
            color={colors.good}
            size="md"
          />
        </View>
      )}

      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Aucune offre ne matche"
            subtitle={
              activeFilterCount > 0
                ? "Tes filtres sont peut-être trop restrictifs. Élargis ou réinitialise."
                : "Configure ton profil pour activer le scoring."
            }
          >
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/filters")}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Ouvrir les filtres</Text>
            </TouchableOpacity>
          </EmptyState>
        ) : (
          filtered.map(({ offer, score }) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              score={score}
              alreadyAdded={isQueuedOrApplied(offer.id)}
              onPress={() =>
                router.push({
                  pathname: "/offer-detail",
                  params: { id: offer.id },
                })
              }
              onAdd={() => enqueueOne(offer.id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 4,
  },
  filterBtnText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.good,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "900",
  },
  emptyBtn: {
    backgroundColor: colors.good,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  emptyBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
