export type Phase = 'plan' | 'review';

export interface DayScore {
  mission: number;   // 0-3
  voies: number;     // 0-3
  rites: number;     // 0-2
  derives: number;   // 0-1
  maitrise: number;  // 0-1
  total: number;     // 0-10
  sceauZero: boolean;
}

export interface DayEntry {
  date: string;           // YYYY-MM-DD
  // I - Cible
  cible: string;
  // II - Activité dominante
  activiteDominante: string;
  // III - Voies
  voies: string[];
  // IV - Antidote
  antidote: string;
  // V - Rites
  rites: string[];
  // VI - Corps & énergie
  energie: number;        // 0-4: -1=unset, 0-4=rated
  // VII - Dérives
  limitations: string[];
  derives: string[];      // actual drifts today
  // VIII - Champ d'influence
  champInfluence: string;
  // IX - Spectres
  spectres: string[];
  // X - Maîtrise
  integrityKept: boolean;
  // XI - Verbe
  verbe: string;

  // Scoring gates
  phase?: Phase;
  reviewedAt?: number;    // timestamp when bilan was sealed
  updatedAt: number;
}

export interface StoredData {
  entries: Record<string, DayEntry>;
  version: number;
}

export interface BackupFile {
  appVersion: string;
  exportedAt: number;
  entries: Record<string, DayEntry>;
}
