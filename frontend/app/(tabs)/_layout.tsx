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
          title: "Pilote",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "rocket" : "rocket-outline"} color={color} size={18} />
            </View>
          ),
          tabBarButtonTestID: "tab-pilote",
        }}
      />
      <Tabs.Screen
        name="offres"
        options={{
          title: "Offres",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "briefcase" : "briefcase-outline"} color={color} size={18} />
            </View>
          ),
          tabBarButtonTestID: "tab-offres",
        }}
      />
      <Tabs.Screen
        name="campagne"
        options={{
          title: "Campagne",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "flash" : "flash-outline"} color={color} size={18} />
            </View>
          ),
          tabBarButtonTestID: "tab-campagne",
        }}
      />
      <Tabs.Screen
        name="suivi"
        options={{
          title: "Suivi",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "trending-up" : "trending-up-outline"} color={color} size={18} />
            </View>
          ),
          tabBarButtonTestID: "tab-suivi",
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? "person" : "person-outline"} color={color} size={18} />
            </View>
          ),
          tabBarButtonTestID: "tab-profil",
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
    height: Platform.select({ ios: 68, default: 60 }),
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
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: 1,
  },
  tabItem: {
    paddingTop: 8,
    paddingBottom: 8,
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
