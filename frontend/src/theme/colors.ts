export const colors = {
  // ── Backgrounds ────────────────────────────────────────────────────────────
  bg: "#080808",
  surface: "#111115",
  surfaceElevated: "#18181C",
  surfaceHigh: "#222228",
  surfaceGlass: "rgba(255,255,255,0.04)",

  // ── Borders ────────────────────────────────────────────────────────────────
  border: "#2A2A30",
  borderSoft: "rgba(255,255,255,0.07)",
  borderHighlight: "rgba(255,255,255,0.14)",

  // ── Text ───────────────────────────────────────────────────────────────────
  textPrimary: "#F4F4F5",
  textSecondary: "#A1A1AA",
  textMuted: "#52525B",

  // ── Accent — neon green ────────────────────────────────────────────────────
  good: "#39FF14",
  goodBg: "rgba(57,255,20,0.10)",
  goodBorder: "rgba(57,255,20,0.30)",
  goodGlow: "rgba(57,255,20,0.18)",

  // ── Urgent — vivid pink ────────────────────────────────────────────────────
  urgent: "#FF3366",
  urgentBg: "rgba(255,51,102,0.10)",
  urgentBorder: "rgba(255,51,102,0.30)",

  // ── Warning — amber ────────────────────────────────────────────────────────
  warning: "#FFAA00",
  warningBg: "rgba(255,170,0,0.10)",
  warningBorder: "rgba(255,170,0,0.30)",

  // ── Info — electric blue ───────────────────────────────────────────────────
  info: "#4FC3FF",
  infoBg: "rgba(79,195,255,0.10)",
  infoBorder: "rgba(79,195,255,0.30)",

  // ── Tab bar ────────────────────────────────────────────────────────────────
  tabBar: "#0E0E12",
  tabBarBorder: "rgba(255,255,255,0.09)",
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  strong: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  glow: {
    shadowColor: "#39FF14",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
