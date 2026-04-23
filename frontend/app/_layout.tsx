import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DataProvider, useData } from "../src/store/context";
import { View } from "react-native";
import { colors } from "../src/theme/colors";
import {
  setupNotifications,
  notifyUrgentActions,
  scheduleDailyReminder,
} from "../src/utils/notifications";
import {
  computeScore,
  computeDecision,
  shouldRepost,
  forceDelete,
  listingFlag,
} from "../src/utils/logic";

function NotificationsBridge() {
  const { stock, retours, clients, loaded } = useData();

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      const granted = await setupNotifications();
      if (cancelled || !granted) return;
      await scheduleDailyReminder();

      let urgent = 0;
      stock.forEach((i) => {
        const score = computeScore(i, retours);
        const d = computeDecision(i, score);
        if (d === "SUPPRIMER" || d === "LIQUIDER" || forceDelete(i)) urgent++;
        else if (shouldRepost(i) || listingFlag(i)) urgent++;
      });
      const now = Date.now();
      clients.forEach((c) => {
        const diffH = (now - new Date(c.lastContact).getTime()) / 3600000;
        if (c.status === "sans_reponse" && diffH >= 24) urgent++;
      });
      if (urgent > 0) await notifyUrgentActions(urgent);
    })();
    return () => {
      cancelled = true;
    };
    // run once when data is first loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <NotificationsBridge />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sourcing" options={{ presentation: "modal" }} />
            <Stack.Screen name="niches" options={{ presentation: "modal" }} />
            <Stack.Screen name="clients" options={{ presentation: "modal" }} />
            <Stack.Screen name="retours" options={{ presentation: "modal" }} />
            <Stack.Screen name="stock-new" options={{ presentation: "modal" }} />
          </Stack>
        </View>
      </DataProvider>
    </SafeAreaProvider>
  );
}
