import React, { useMemo } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useData, StockItem } from "../../src/store/context";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card, SectionTitle } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import {
  computeScore,
  computeDecision,
  shouldRepost,
  forceDelete,
  suggestedPrice,
} from "../../src/utils/logic";

export default function ActionScreen() {
  const { stock, ventes, retours, clients, deleteStock, updateStock, updateClient } =
    useData();

  const { toDelete, toDrop, toRepost, toRelaunch } = useMemo(() => {
    const toDelete: StockItem[] = [];
    const toDrop: { item: StockItem; suggested: number }[] = [];
    const toRepost: StockItem[] = [];
    stock.forEach((item) => {
      const score = computeScore(item, retours);
      const decision = computeDecision(item, score);
      if (decision === "SUPPRIMER" || forceDelete(item)) {
        toDelete.push(item);
      } else if (decision === "BAISSER" || decision === "LIQUIDER") {
        toDrop.push({
          item,
          suggested: suggestedPrice(item, ventes),
        });
      } else if (shouldRepost(item)) {
        toRepost.push(item);
      }
    });
    const now = Date.now();
    const toRelaunch = clients.filter((c) => {
      const diffH = (now - new Date(c.lastContact).getTime()) / 3600000;
      return c.status === "sans_reponse" && diffH >= 24;
    });
    return { toDelete, toDrop, toRepost, toRelaunch };
  }, [stock, ventes, retours, clients]);

  const nothing =
    toDelete.length === 0 &&
    toDrop.length === 0 &&
    toRepost.length === 0 &&
    toRelaunch.length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      testID="action-scroll"
    >
      <ScreenHeader
        title="Mode Action"
        subtitle="Que des actions. Pas de blabla."
      />

      {nothing ? (
        <Card testID="action-empty">
          <Text style={styles.empty}>
            Tout est sous contrôle ✓
          </Text>
          <Text style={styles.emptyHint}>
            Aucune action urgente en ce moment.
          </Text>
        </Card>
      ) : (
        <>
          {toDelete.length > 0 && (
            <>
              <SectionTitle
                title="À supprimer"
                subtitle={`${toDelete.length} article${toDelete.length > 1 ? "s" : ""}`}
              />
              {toDelete.map((i) => (
                <Card key={i.id} style={styles.card} testID={`action-delete-${i.id}`}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{i.name}</Text>
                      <Text style={styles.meta}>
                        {i.brand} • {i.daysOnline}j • {i.views} vues
                      </Text>
                    </View>
                    <Badge label="SUPPRIMER" tone="urgent" />
                  </View>
                  <Button
                    label="Supprimer"
                    variant="danger"
                    onPress={() => deleteStock(i.id)}
                    testID={`action-delete-btn-${i.id}`}
                  />
                </Card>
              ))}
            </>
          )}

          {toDrop.length > 0 && (
            <>
              <SectionTitle
                title="Baisser le prix"
                subtitle={`${toDrop.length} article${toDrop.length > 1 ? "s" : ""}`}
              />
              {toDrop.map(({ item, suggested }) => (
                <Card key={item.id} style={styles.card} testID={`action-drop-${item.id}`}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>
                        {item.brand} • Actuel {item.sellPrice}€ → Suggéré{" "}
                        <Text style={{ color: colors.good, fontWeight: "900" }}>
                          {suggested}€
                        </Text>
                      </Text>
                    </View>
                    <Badge label="BAISSER" tone="warning" />
                  </View>
                  <Button
                    label={`Appliquer ${suggested}€`}
                    variant="primary"
                    onPress={() =>
                      updateStock(item.id, { sellPrice: suggested })
                    }
                    testID={`action-drop-btn-${item.id}`}
                  />
                </Card>
              ))}
            </>
          )}

          {toRepost.length > 0 && (
            <>
              <SectionTitle
                title="À reposter"
                subtitle={`${toRepost.length} annonce${toRepost.length > 1 ? "s" : ""}`}
              />
              {toRepost.map((i) => (
                <Card key={i.id} style={styles.card} testID={`action-repost-${i.id}`}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{i.name}</Text>
                      <Text style={styles.meta}>
                        {i.brand} • {i.daysOnline}j • {i.favorites} favoris
                      </Text>
                    </View>
                    <Badge label="REPOSTER" tone="info" />
                  </View>
                  <Button
                    label="Reposter l'annonce"
                    variant="secondary"
                    onPress={() =>
                      updateStock(i.id, {
                        views: 0,
                        favorites: 0,
                        daysOnline: 0,
                        repostCount: (i.repostCount || 0) + 1,
                      })
                    }
                    testID={`action-repost-btn-${i.id}`}
                  />
                </Card>
              ))}
            </>
          )}

          {toRelaunch.length > 0 && (
            <>
              <SectionTitle
                title="Relancer clients"
                subtitle={`${toRelaunch.length} client${toRelaunch.length > 1 ? "s" : ""}`}
              />
              {toRelaunch.map((c) => (
                <Card key={c.id} style={styles.card} testID={`action-relaunch-${c.id}`}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>@{c.pseudo}</Text>
                      <Text style={styles.meta}>
                        {c.product} • dernière activité{" "}
                        {new Date(c.lastContact).toLocaleDateString("fr-FR")}
                      </Text>
                    </View>
                    <Badge label="RELANCER" tone="warning" />
                  </View>
                  <Button
                    label="Marquer comme relancé"
                    variant="primary"
                    onPress={() =>
                      updateClient(c.id, { status: "negociation" })
                    }
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
  container: { paddingHorizontal: 20, paddingBottom: 80 },
  card: { marginBottom: 12 },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  empty: {
    color: colors.good,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },
});
