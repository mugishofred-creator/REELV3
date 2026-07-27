import React, { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useData, type AppStatus } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { EmptyState } from "../../src/components/EmptyState";
import { Badge } from "../../src/components/Badge";
import { Chip } from "../../src/components/Chip";
import { colors, radius } from "../../src/theme/colors";
import {
  daysUntil,
  platformColor,
  platformInitials,
  statusLabel,
  statusTone,
  timeAgoISO,
} from "../../src/utils/format";

type Filter = "all" | "active" | "interview" | "followup";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "Tout", value: "all" },
  { label: "Actives", value: "active" },
  { label: "Entretiens", value: "interview" },
  { label: "Relances", value: "followup" },
];

const STATUS_ORDER: AppStatus[] = [
  "file",
  "envoyee",
  "vue",
  "entretien",
  "offre",
  "refus",
];

export default function SuiviScreen() {
  const router = useRouter();
  const { applications } = useData();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    let list = [...applications];
    if (filter === "active") {
      list = list.filter((a) => a.status !== "refus");
    } else if (filter === "interview") {
      list = list.filter((a) => a.status === "entretien" || a.status === "offre");
    } else if (filter === "followup") {
      list = list.filter((a) => {
        if (!a.nextFollowUp || a.followUpSent) return false;
        const d = daysUntil(a.nextFollowUp);
        return d !== null && d <= 0;
      });
    }
    list.sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  }, [applications, filter]);

  const counts = useMemo(() => {
    const c: Record<AppStatus, number> = {
      file: 0,
      envoyee: 0,
      vue: 0,
      entretien: 0,
      offre: 0,
      refus: 0,
    };
    applications.forEach((a) => {
      c[a.status]++;
    });
    return c;
  }, [applications]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <ScreenHeader
        title="Suivi"
        subtitle={`Pipeline · ${applications.length} candidature${applications.length > 1 ? "s" : ""}`}
      />

      <View style={styles.pipelineRow}>
        {STATUS_ORDER.map((s) => (
          <View key={s} style={styles.pipeCell}>
            <Text style={styles.pipeNum}>{counts[s]}</Text>
            <Text style={styles.pipeLbl}>{statusLabel(s)}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            active={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title="Aucune candidature"
            subtitle="Ajoute des offres depuis l'onglet Offres puis lance ta campagne."
          />
        ) : (
          filtered.map((a) => {
            const overdue =
              a.nextFollowUp && !a.followUpSent && (daysUntil(a.nextFollowUp) ?? 1) <= 0;
            return (
              <TouchableOpacity
                key={a.id}
                style={styles.row}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/application-detail",
                    params: { id: a.id },
                  })
                }
              >
                <View
                  style={[
                    styles.platBadge,
                    {
                      backgroundColor: `${platformColor(a.offer.platform)}22`,
                      borderColor: `${platformColor(a.offer.platform)}55`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.platText,
                      { color: platformColor(a.offer.platform) },
                    ]}
                  >
                    {platformInitials(a.offer.platform)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {a.offer.title}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {a.offer.company} · {timeAgoISO(a.updatedAt)}
                  </Text>
                  {overdue && (
                    <View style={styles.overdueRow}>
                      <Ionicons name="alert-circle" size={12} color={colors.warning} />
                      <Text style={styles.overdueText}>Relance à envoyer</Text>
                    </View>
                  )}
                </View>
                <Badge label={statusLabel(a.status)} tone={statusTone(a.status)} />
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pipelineRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 14,
  },
  pipeCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  pipeNum: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  pipeLbl: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 2,
    textAlign: "center",
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  platBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  platText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  overdueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  overdueText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
