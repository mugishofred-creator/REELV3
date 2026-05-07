import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { colors, shadow } from "../../src/theme/colors";
import { Platform, View, StyleSheet } from "react-native";

function TabBarBackground() {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={60}
        tint="dark"
        style={[StyleSheet.absoluteFill, styles.blurWrap]}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, styles.androidBg]} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.good,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () => <TabBarBackground />,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "grid" : "grid-outline"} color={color} size={20} />
            </View>
          ),
          tabBarButtonTestID: "tab-dashboard",
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "shirt" : "shirt-outline"} color={color} size={20} />
            </View>
          ),
          tabBarButtonTestID: "tab-stock",
        }}
      />
      <Tabs.Screen
        name="ventes"
        options={{
          title: "Ventes",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name="trending-up" color={color} size={20} />
            </View>
          ),
          tabBarButtonTestID: "tab-ventes",
        }}
      />
      <Tabs.Screen
        name="action"
        options={{
          title: "Action",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "flash" : "flash-outline"} color={color} size={20} />
            </View>
          ),
          tabBarButtonTestID: "tab-action",
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          title: "Plus",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "apps" : "apps-outline"} color={color} size={20} />
            </View>
          ),
          tabBarButtonTestID: "tab-plus",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: Platform.select({ ios: 28, default: 20 }),
    left: 16,
    right: 16,
    height: Platform.select({ ios: 68, default: 64 }),
    borderRadius: 28,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
    borderWidth: 1,
    borderColor: colors.tabBarBorder,
    backgroundColor: "transparent",
    paddingBottom: 0,
    paddingTop: 0,
    ...shadow.strong,
  },
  blurWrap: {
    borderRadius: 28,
    overflow: "hidden",
  },
  androidBg: {
    borderRadius: 28,
    backgroundColor: colors.tabBar,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  iconWrap: {
    width: 36,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: colors.goodGlow,
  },
});
