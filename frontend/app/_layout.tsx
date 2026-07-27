import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { DataProvider } from "../src/store/context";
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
            <Stack.Screen name="offer-detail" options={{ presentation: "modal" }} />
            <Stack.Screen name="filters" options={{ presentation: "modal" }} />
            <Stack.Screen name="letter-editor" options={{ presentation: "modal" }} />
            <Stack.Screen name="application-detail" options={{ presentation: "modal" }} />
            <Stack.Screen name="profile-edit" options={{ presentation: "modal" }} />
            <Stack.Screen name="ai-settings" options={{ presentation: "modal" }} />
          </Stack>
        </View>
      </DataProvider>
    </SafeAreaProvider>
  );
}
