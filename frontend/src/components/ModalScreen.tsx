import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export function ModalScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={styles.kicker}>VINTED MANAGER</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.close}
          testID="modal-close"
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  kickerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.good,
    shadowColor: colors.good,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  kicker: {
    color: colors.good,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 32,
  },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "500" },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
});
