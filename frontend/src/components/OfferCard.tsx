import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow } from "../theme/colors";
import { Badge } from "./Badge";
import {
  formatSalary,
  platformColor,
  platformInitials,
  remoteIcon,
  timeAgo,
} from "../utils/format";
import { scoreColor } from "../utils/match";
import type { Offer } from "../store/context";

export function OfferCard({
  offer,
  score,
  alreadyAdded,
  onPress,
  onAdd,
}: {
  offer: Offer;
  score?: number;
  alreadyAdded?: boolean;
  onPress?: () => void;
  onAdd?: () => void;
}) {
  const pColor = platformColor(offer.platform);
  const scoreTone = score !== undefined ? scoreColor(score) : "good";
  const scoreAccent =
    scoreTone === "good" ? colors.good
    : scoreTone === "warning" ? colors.warning
    : colors.urgent;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={[styles.platformChip, { borderColor: `${pColor}55`, backgroundColor: `${pColor}22` }]}>
          <Text style={[styles.platformText, { color: pColor }]}>
            {platformInitials(offer.platform)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.company} numberOfLines={1}>
            {offer.company}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {offer.title}
          </Text>
        </View>
        {score !== undefined && (
          <View
            style={[
              styles.scoreWrap,
              { borderColor: `${scoreAccent}55`, backgroundColor: `${scoreAccent}1A` },
            ]}
          >
            <Text style={[styles.scoreVal, { color: scoreAccent }]}>{score}</Text>
            <Text style={[styles.scoreLbl, { color: scoreAccent }]}>MATCH</Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>{offer.location}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons
            name={remoteIcon(offer.remote) as React.ComponentProps<typeof Ionicons>["name"]}
            size={12}
            color={colors.textMuted}
          />
          <Text style={styles.metaText}>{offer.remote}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>{timeAgo(offer.postedDaysAgo)}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.badgeRow}>
          <Badge label={offer.contract} tone="info" />
          {offer.salaryMin || offer.salaryMax ? (
            <Text style={styles.salary}>{formatSalary(offer.salaryMin, offer.salaryMax)}</Text>
          ) : null}
        </View>
        {onAdd && (
          <TouchableOpacity
            onPress={onAdd}
            disabled={alreadyAdded}
            style={[
              styles.addBtn,
              alreadyAdded ? styles.addBtnDone : styles.addBtnNew,
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={alreadyAdded ? "checkmark" : "add"}
              size={14}
              color={alreadyAdded ? colors.textPrimary : "#000"}
            />
            <Text
              style={[
                styles.addBtnText,
                { color: alreadyAdded ? colors.textPrimary : "#000" },
              ]}
            >
              {alreadyAdded ? "AJOUTÉE" : "AJOUTER"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
    gap: 12,
    ...shadow.card,
  },
  topRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  platformChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  platformText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  company: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
    lineHeight: 19,
    marginTop: 2,
  },
  scoreWrap: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 52,
  },
  scoreVal: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  scoreLbl: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: -2,
  },
  metaRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  salary: {
    color: colors.good,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  addBtnNew: {
    backgroundColor: colors.good,
    borderColor: colors.good,
  },
  addBtnDone: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: colors.border,
  },
  addBtnText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
