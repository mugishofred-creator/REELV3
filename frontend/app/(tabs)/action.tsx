import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Thumb } from "../../src/components/Thumb";
import { ProgressBar } from "../../src/components/ProgressBar";
import { colors } from "../../src/theme/colors";
import { shouldRepost, forceDelete, suggestedPrice } from "../../src/utils/logic";
import { useAnalyzedStock } from "../../src/hooks/useAnalyzedStock";

export default function ActionScreen() {
  const { ventes, clients, deleteStock, updateStock, updateClient } = useData();
  const analyzed = useAnalyzedStock();

  const { toDelete, toDrop, toRepost, toRelaunch, total } = useMemo(() => {
    const toDelete: typeof analyzed[0]["item"][] = [];
    const toDrop: { item: typeof analyzed[0]["item"]; suggested: number; label: string }[] = [];
    const toRepost: typeof analyzed[0]["item"][] = [];

    analyzed.forEach(({ item, analysis: a }) => {
      if (a.action === "SUPPRIMER" || forceDelete(item)) {
        toDelete.push(item);
      } else if (a.action === "LIQUIDER") {
        toDrop.push({ item, suggested: suggestedPrice(item, ventes), label: "LIQUIDER" });
      } else if (a.action === "BAISSE_IMMEDIATE") {
        toDrop.push({ item, suggested: suggestedPrice(item, ventes), label: "BAISSE IMMÉD." });
      } else if (a.action === "BAISSER") {
        toDrop.push({ item, suggested: suggestedPrice(item, ventes), label: "BAISSER" });
      } else if (a.action === "REPOST" || shouldRepost(item)) {
        toRepost.push(item);
      }
    });

    const now = Date.now();
    const toRelaunch = clients.filter((c) => {
      const diffH = (now - new Date(c.lastContact).getTime()) / 3600000;
      return c.status === "sans_reponse" && diffH >= 24;
    });

    const total = toDelete.length + toDrop.length + toRepost.length + toRelaunch.length;
    return { toDelete, toDrop, toRepost, toRelaunch, total };
  }, [analyzed, ventes, clients]);

  const nothing = total === 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      testID="action-scroll"
    >
      <ScreenHeader
        title="Mode Action"
        subtitle={nothing ? "Tout est à jour ✓" : `${total} action${total > 1 ? "s" : ""} à traiter`}
      />

      {/* ── JAUGE DE PROGRESSION ── */}
      {!nothing && (
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Checklist du jour</Text>
            <Text style={styles.progressCount}>{total} restante{total > 1 ? "s" : ""}</Text>
          </View>
          <View style={styles.sectionPills}>
            {toDelete.length > 0 && (
              <View style={[styles.pill, { backgroundColor: colors.urgentBg, borderColor: colors.urgentBorder }]}>
                <Text style={[styles.pillText, { color: colors.urgent }]}>
                  ✕ {toDelete.length} suppr.
                </Text>
              </View>
            )}
            {toDrop.length > 0 && (
              <View style={[styles.pill, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
                <Text style={[styles.pillText, { color: colors.warning }]}>
                  ↓ {toDrop.length} prix
                </Text>
              </View>
            )}
            {toRepost.length > 0 && (
              <View style={[styles.pill, { backgroundColor: colors.infoBg, borderColor: colors.infoBorder }]}>
                <Text style={[styles.pillText, { color: colors.info }]}>
                  ↺ {toRepost.length} reposts
                </Text>
              </View>
            )}
            {toRelaunch.length > 0 && (
              <View style={[styles.pill, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
                <Text style={[styles.pillText, { color: colors.warning }]}>
                  💬 {toRelaunch.length} clients
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {nothing ? (
        <Card testID="action-empty">
          <Text style={styles.emptyBig}>✓</Text>
          <Text style={styles.empty}>Tout est sous contrôle</Text>
          <Text style={styles.emptyHint}>Aucune action urgente. Continue comme ça !</Text>
        </Card>
      ) : (
        <>
          {/* ── À SUPPRIMER ── */}
          {toDelete.length > 0 && (
            <>
              <SectionTitle
                title="À supprimer"
                subtitle={`${toDelete.length} article${toDelete.length > 1 ? "s" : ""} — pas rentables`}
              />
              {toDelete.map((i) => (
                <Card key={i.id} style={styles.card} testID={`action-delete-${i.id}`}>
                  <View style={styles.rowHead}>
                    <Thumb uri={i.image} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{i.name}</Text>
                      <Text style={styles.meta}>{i.brand} · {i.daysOnline}j · {i.views} vues</Text>
                    </View>
                    <Badge label="SUPPRIMER" tone="urgent" />
                  </View>
                  <Button
                    label="Supprimer définitivement"
                    variant="danger"
                    onPress={() => deleteStock(i.id)}
                    testID={`action-delete-btn-${i.id}`}
                  />
                </Card>
              ))}
            </>
          )}

          {/* ── BAISSER LE PRIX ── */}
          {toDrop.length > 0 && (
            <>
              <SectionTitle
                title="Baisser le prix"
                subtitle={`${toDrop.length} article${toDrop.length > 1 ? "s" : ""} — baisse pour vendre`}
              />
              {toDrop.map(({ item, suggested, label }) => (
                <Card key={item.id} style={styles.card} testID={`action-drop-${item.id}`}>
                  <View style={styles.rowHead}>
                    <Thumb uri={item.image} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>
                        {item.brand} · {item.sellPrice}€{suggested > 0 && suggested !== item.sellPrice ? ` → ` : ""}
                        {suggested > 0 && suggested !== item.sellPrice && (
                          <Text style={{ color: colors.good, fontWeight: "900" }}>{suggested}€</Text>
                        )}
                      </Text>
                    </View>
                    <Badge
                      label={label}
                      tone={label === "LIQUIDER" ? "urgent" : "warning"}
                    />
                  </View>
                  {suggested > 0 && suggested !== item.sellPrice ? (
                    <Button
                      label={`Appliquer ${suggested}€`}
                      variant="primary"
                      onPress={() => updateStock(item.id, { sellPrice: suggested })}
                      testID={`action-drop-btn-${item.id}`}
                    />
                  ) : (
                    <Text style={styles.hint}>Baisse manuellement le prix sur Vinted</Text>
                  )}
                </Card>
              ))}
            </>
          )}

          {/* ── À REPOSTER ── */}
          {toRepost.length > 0 && (
            <>
              <SectionTitle
                title="À reposter"
                subtitle={`${toRepost.length} annonce${toRepost.length > 1 ? "s" : ""} — visibilité à renouveler`}
              />
              {toRepost.map((i) => (
                <Card key={i.id} style={styles.card} testID={`action-repost-${i.id}`}>
                  <View style={styles.rowHead}>
                    <Thumb uri={i.image} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{i.name}</Text>
                      <Text style={styles.meta}>{i.brand} · {i.daysOnline}j · {i.favorites} ❤</Text>
                    </View>
                    <Badge label="REPOSTER" tone="info" />
                  </View>
                  <Button
                    label="Reposter l'annonce"
                    variant="secondary"
                    onPress={() =>
                      updateStock(i.id, {
                        views: 0, favorites: 0, daysOnline: 0,
                        repostCount: (i.repostCount || 0) + 1,
                        datePublication: new Date().toISOString(),
                      })
                    }
                    testID={`action-repost-btn-${i.id}`}
                  />
                </Card>
              ))}
            </>
          )}

          {/* ── RELANCER CLIENTS ── */}
          {toRelaunch.length > 0 && (
            <>
              <SectionTitle
                title="Relancer clients"
                subtitle={`${toRelaunch.length} client${toRelaunch.length > 1 ? "s" : ""} sans réponse depuis >24h`}
              />
              {toRelaunch.map((c) => (
                <Card key={c.id} style={styles.card} testID={`action-relaunch-${c.id}`}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>@{c.pseudo}</Text>
                      <Text style={styles.meta}>
                        {c.product} · dernière activité{" "}
                        {new Date(c.lastContact).toLocaleDateString("fr-FR")}
                      </Text>
                    </View>
                    <Badge label="RELANCER" tone="warning" />
                  </View>
                  <Button
                    label="Marquer comme relancé"
                    variant="primary"
                    onPress={() => updateClient(c.id, { status: "negociation" })}
                    testID={`action-relaunch-btn-${c.id}`}
                  />
                </Card>
              ))}
            </>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 100 },
  progressCard: { marginBottom: 16 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900" },
  progressCount: { color: colors.textMuted, fontSize: 13 },
  sectionPills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: "800" },
  card: { marginBottom: 12 },
  rowHead: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", gap: 12, marginBottom: 12,
  },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 6 },
  emptyBig: { color: colors.good, fontSize: 40, textAlign: "center", marginBottom: 6 },
  empty: { color: colors.good, fontSize: 18, fontWeight: "900", textAlign: "center" },
  emptyHint: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 6 },
});
