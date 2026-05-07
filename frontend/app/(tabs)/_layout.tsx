import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme/colors";
import { Platform, View, StyleSheet } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.good,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
          tabBarButtonTestID: "tab-dashboard",
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shirt-outline" color={color} size={size} />
          ),
          tabBarButtonTestID: "tab-stock",
        }}
      />
      <Tabs.Screen
        name="ventes"
        options={{
          title: "Ventes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" color={color} size={size} />
          ),
          tabBarButtonTestID: "tab-ventes",
        }}
      />
      <Tabs.Screen
        name="action"
        options={{
          title: "Action",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" color={color} size={size} />
          ),
          tabBarButtonTestID: "tab-action",
        }}
      />
      <Tabs.Screen
        name="sniper"
        options={{
          title: "Sniper",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "locate" : "locate-outline"} color={color} size={18} />
            </View>
          ),
          tabBarButtonTestID: "tab-sniper",
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          title: "Plus",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" color={color} size={size} />
          ),
          tabBarButtonTestID: "tab-plus",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#0A0A0A",
    borderTopColor: colors.borderSoft,
    borderTopWidth: 1,
    height: Platform.select({ ios: 88, default: 78 }),
    paddingBottom: Platform.select({ ios: 28, default: 16 }),
    paddingTop: 6,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  iconWrap: {
    width: 32,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  iconWrapActive: {
    backgroundColor: colors.goodGlow,
  },
});
