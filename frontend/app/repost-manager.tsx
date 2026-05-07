import React, { useState, useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card } from "../src/components/Card";
import { colors } from "../src/theme/colors";
import { useData, StockItem } from "../src/store/context";

// ─── Helpers ────────────────────────────────────────────────────────────────

function repostAge(item: StockItem): number {
  const ref = item.lastRepostDate || item.datePublication || item.createdAt;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
}

type Urgency = "urgent" | "bientot" | "ok";

function getUrgency(age: number): Urgency {
  if (age >= 7) return "urgent";
  if (age >= 3) return "bientot";
  return "ok";
}

const URGENCY_COLOR: Record<Urgency, string> = {
  urgent: colors.urgent,
  bientot: colors.warning,
  ok: colors.good,
};

const URGENCY_BG: Record<Urgency, string> = {
  urgent: colors.urgentBg,
  bientot: colors.warningBg,
  ok: colors.goodBg,
};

const URGENCY_BORDER: Record<Urgency, string> = {
  urgent: colors.urgentBorder,
  bientot: colors.warningBorder,
  ok: colors.goodBorder,
};

const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: "URGENT",
  bientot: "BIENTÔT",
  ok: "OK",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  urgency: Urgency;
  count: number;
}

function SectionHeader({ urgency, count }: SectionHeaderProps) {
  const color = URGENCY_COLOR[urgency];
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <Text style={[styles.sectionLabel, { color }]}>
        {URGENCY_LABEL[urgency]}
      </Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

interface ItemCardProps {
  item: StockItem;
  age: number;
  urgency: Urgency;
  reposted: boolean;
  onRepost: () => void;
}

function ItemCard({ item, age, urgency, reposted, onRepost }: ItemCardProps) {
  const borderColor = URGENCY_COLOR[urgency];
  const ageLabel = age === 0 ? "Aujourd'hui" : `${age} jours`;

  return (
    <Card
      style={[
        styles.itemCard,
        { borderLeftWidth: 3, borderLeftColor: borderColor },
      ]}
    >
      <View style={styles.itemTop}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemMeta}>
            {item.brand}
            {" · "}
            {ageLabel}
            {item.repostCount > 0 ? ` · ${item.repostCount}× reposté` : ""}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: URGENCY_BG[urgency],
              borderColor: URGENCY_BORDER[urgency],
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: URGENCY_COLOR[urgency] }]}>
            {URGENCY_LABEL[urgency]}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onRepost}
        disabled={reposted}
        style={[
          styles.repostButton,
          reposted
            ? styles.repostButtonDone
            : styles.repostButtonDefault,
        ]}
        activeOpacity={0.75}
      >
        <Text
          style={[
            styles.repostButtonText,
            reposted
              ? styles.repostButtonTextDone
              : styles.repostButtonTextDefault,
          ]}
        >
          {reposted ? "✓ Reposté" : "Reposter"}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RepostManagerScreen() {
  const { stock, updateStock } = useData();
  const [repostedToday, setRepostedToday] = useState<Set<string>>(new Set());

  const activeItems = useMemo(
    () => stock.filter((item) => !item.sold),
    [stock]
  );

  interface EnrichedItem {
    item: StockItem;
    age: number;
    urgency: Urgency;
  }

  const enriched: EnrichedItem[] = useMemo(
    () =>
      activeItems.map((item) => {
        const age = repostAge(item);
        return { item, age, urgency: getUrgency(age) };
      }),
    [activeItems]
  );

  const urgentItems = useMemo(
    () =>
      enriched
        .filter((e) => e.urgency === "urgent")
        .sort((a, b) => b.age - a.age),
    [enriched]
  );

  const bientotItems = useMemo(
    () =>
      enriched
        .filter((e) => e.urgency === "bientot")
        .sort((a, b) => b.age - a.age),
    [enriched]
  );

  const okItems = useMemo(
    () =>
      enriched
        .filter((e) => e.urgency === "ok")
        .sort((a, b) => b.age - a.age),
    [enriched]
  );

  function handleRepost(item: StockItem) {
    updateStock(item.id, {
      lastRepostDate: new Date().toISOString(),
      repostCount: (item.repostCount || 0) + 1,
    });
    setRepostedToday((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }

  const repostedTodayCount = repostedToday.size;
  const urgentCount = urgentItems.length;
  const totalActive = activeItems.length;

  const subtitle = `${totalActive} article${totalActive !== 1 ? "s" : ""} en stock`;

  return (
    <ModalScreen title="Repost Manager" subtitle={subtitle}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Counter card ── */}
        <Card style={styles.counterCard}>
          <View style={styles.counterRow}>
            <View style={styles.counterItem}>
              <Text style={styles.counterValue}>{repostedTodayCount}</Text>
              <Text style={styles.counterLabel}>Repostés aujourd'hui</Text>
            </View>
            <View style={styles.counterDivider} />
            <View style={styles.counterItem}>
              <Text style={[styles.counterValue, { color: colors.urgent }]}>
                {urgentCount}
              </Text>
              <Text style={styles.counterLabel}>Urgents</Text>
            </View>
            <View style={styles.counterDivider} />
            <View style={styles.counterItem}>
              <Text style={styles.counterValue}>{totalActive}</Text>
              <Text style={styles.counterLabel}>En stock</Text>
            </View>
          </View>
        </Card>

        {/* ── Empty state ── */}
        {totalActive === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aucun article en stock.</Text>
          </Card>
        )}

        {/* ── URGENT section ── */}
        {urgentItems.length > 0 && (
          <>
            <SectionHeader urgency="urgent" count={urgentItems.length} />
            {urgentItems.map(({ item, age, urgency }) => (
              <ItemCard
                key={item.id}
                item={item}
                age={age}
                urgency={urgency}
                reposted={repostedToday.has(item.id)}
                onRepost={() => handleRepost(item)}
              />
            ))}
          </>
        )}

        {/* ── BIENTÔT section ── */}
        {bientotItems.length > 0 && (
          <>
            <SectionHeader urgency="bientot" count={bientotItems.length} />
            {bientotItems.map(({ item, age, urgency }) => (
              <ItemCard
                key={item.id}
                item={item}
                age={age}
                urgency={urgency}
                reposted={repostedToday.has(item.id)}
                onRepost={() => handleRepost(item)}
              />
            ))}
          </>
        )}

        {/* ── OK section ── */}
        {okItems.length > 0 && (
          <>
            <SectionHeader urgency="ok" count={okItems.length} />
            {okItems.map(({ item, age, urgency }) => (
              <ItemCard
                key={item.id}
                item={item}
                age={age}
                urgency={urgency}
                reposted={repostedToday.has(item.id)}
                onRepost={() => handleRepost(item)}
              />
            ))}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </ModalScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Counter card
  counterCard: {
    marginBottom: 20,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterItem: {
    flex: 1,
    alignItems: "center",
  },
  counterValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  counterLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 3,
    textAlign: "center",
  },
  counterDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderSoft,
  },

  // Empty state
  emptyCard: {
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 8,
    gap: 7,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    flex: 1,
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  // Item card — base (overridden inline for borderLeft color)
  itemCard: {
    marginBottom: 10,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  // Repost button — default (outline green)
  repostButton: {
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  repostButtonDefault: {
    borderWidth: 1,
    borderColor: colors.good,
    backgroundColor: "transparent",
  },
  repostButtonDone: {
    borderWidth: 0,
    backgroundColor: colors.good,
  },
  repostButtonText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  repostButtonTextDefault: {
    color: colors.good,
  },
  repostButtonTextDone: {
    color: "#000",
  },

  bottomPad: {
    height: 20,
  },
});
