import type {
  AppStatus,
  Platform,
  RemoteMode,
} from "../store/context";
import { colors } from "../theme/colors";

export function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return "—";
  const fmt = (n: number) => {
    if (n < 3000) return `${n} €/mois`;
    if (n >= 1000) return `${Math.round(n / 1000)} k€`;
    return `${n} €`;
  };
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max)!);
}

export function timeAgo(daysAgo: number): string {
  if (daysAgo <= 0) return "Aujourd'hui";
  if (daysAgo === 1) return "Hier";
  if (daysAgo < 7) return `Il y a ${daysAgo} j`;
  if (daysAgo < 30) return `Il y a ${Math.floor(daysAgo / 7)} sem`;
  return `Il y a ${Math.floor(daysAgo / 30)} mois`;
}

export function timeAgoISO(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  return timeAgo(days);
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function statusLabel(s: AppStatus): string {
  switch (s) {
    case "file": return "En file";
    case "envoyee": return "Envoyée";
    case "vue": return "Vue";
    case "entretien": return "Entretien";
    case "offre": return "Offre reçue";
    case "refus": return "Refus";
  }
}

export function statusTone(s: AppStatus): "good" | "urgent" | "warning" | "info" | "neutral" {
  switch (s) {
    case "file": return "neutral";
    case "envoyee": return "info";
    case "vue": return "info";
    case "entretien": return "warning";
    case "offre": return "good";
    case "refus": return "urgent";
  }
}

export function platformColor(p: Platform): string {
  switch (p) {
    case "LinkedIn": return "#4FC3FF";
    case "Indeed": return "#3F8CFF";
    case "Welcome to the Jungle": return "#FFAA00";
    case "APEC": return "#FF3366";
    case "HelloWork": return "#39FF14";
    case "France Travail": return "#A78BFA";
    case "Glassdoor": return "#22D3EE";
    default: return colors.textSecondary;
  }
}

export function platformInitials(p: Platform): string {
  switch (p) {
    case "LinkedIn": return "in";
    case "Indeed": return "ID";
    case "Welcome to the Jungle": return "WJ";
    case "APEC": return "AP";
    case "HelloWork": return "HW";
    case "France Travail": return "FT";
    case "Glassdoor": return "GD";
    default: return "?";
  }
}

export function remoteIcon(r: RemoteMode): string {
  switch (r) {
    case "Sur site": return "business-outline";
    case "Hybride": return "swap-horizontal-outline";
    case "Télétravail": return "home-outline";
  }
}

export const ALL_PLATFORMS: Platform[] = [
  "LinkedIn",
  "Indeed",
  "Welcome to the Jungle",
  "APEC",
  "HelloWork",
  "France Travail",
  "Glassdoor",
];

export const ALL_CONTRACTS = [
  "CDI",
  "CDD",
  "Stage",
  "Alternance",
  "Freelance",
  "Intérim",
] as const;

export const ALL_REMOTE: RemoteMode[] = ["Sur site", "Hybride", "Télétravail"];
