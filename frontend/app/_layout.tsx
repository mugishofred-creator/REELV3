import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DataProvider } from "../src/store/context";
import { View } from "react-native";
import { colors } from "../src/theme/colors";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="sourcing"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="niches" options={{ presentation: "modal" }} />
            <Stack.Screen name="clients" options={{ presentation: "modal" }} />
            <Stack.Screen name="retours" options={{ presentation: "modal" }} />
            <Stack.Screen
              name="stock-new"
              options={{ presentation: "modal" }}
            />
          </Stack>
        </View>
      </DataProvider>
    </SafeAreaProvider>
  );
}
