import { DayEntry, DayScore, Phase } from './types';

export function defaultPhase(): Phase {
  const h = new Date().getHours();
  return h < 17 ? 'plan' : 'review';
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isReviewed(entry: DayEntry): boolean {
  return typeof entry.reviewedAt === 'number' && entry.reviewedAt > 0;
}

export function scoreMission(entry: DayEntry): number {
  // 0-3: cible(1) + activiteDominante(1) + energie(1)
  let s = 0;
  if (entry.cible?.trim()) s++;
  if (entry.activiteDominante?.trim()) s++;
  if (entry.energie >= 3) s++; // high energy = bonus point
  return Math.min(3, s);
}

export function scoreVoies(entry: DayEntry): number {
  // 0-3: each voie ticked = 1 point, max 3
  const count = (entry.voies || []).filter(v => v?.trim()).length;
  return Math.min(3, count);
}

export function scoreRites(entry: DayEntry): number {
  // 0-2: rites ticked
  const count = (entry.rites || []).filter(r => r?.trim()).length;
  if (count === 0) return 0;
  if (count <= 2) return 1;
  return 2;
}

export function scoreDrift(entry: DayEntry): number {
  // 0-1: 1 if no actual drifts from declared limitations
  if (!entry.limitations || entry.limitations.length === 0) return 0;
  const hasDrift = (entry.derives || []).some(d => d?.trim());
  return hasDrift ? 0 : 1;
}

export function scoreMaitrise(entry: DayEntry): number {
  // 0-1: integrity kept
  return entry.integrityKept ? 1 : 0;
}

export function scoreDay(entry: DayEntry): DayScore {
  const mission = scoreMission(entry);
  const voies = scoreVoies(entry);
  const rites = scoreRites(entry);
  const derives = scoreDrift(entry);
  const maitrise = scoreMaitrise(entry);
  const total = mission + voies + rites + derives + maitrise;

  // Sceau Zéro: if no cible, no voies, no rites → total forced to 0
  const sceauZero = !entry.cible?.trim() &&
    (entry.voies || []).filter(v => v?.trim()).length === 0 &&
    (entry.rites || []).filter(r => r?.trim()).length === 0;

  return {
    mission,
    voies,
    rites,
    derives,
    maitrise,
    total: sceauZero ? 0 : total,
    sceauZero,
  };
}

export function interpLabel(total: number): string {
  if (total <= 2) return 'En dérive';
  if (total <= 4) return 'Fragile';
  if (total <= 6) return 'En construction';
  if (total <= 8) return 'Discipliné';
  return 'Maître';
}

export function interpColor(total: number): string {
  if (total <= 2) return '#D7444C';
  if (total <= 4) return '#E89042';
  if (total <= 6) return '#6E8AB5';
  if (total <= 8) return '#E8B947';
  return '#5BA66A';
}

export function calcXP(entry: DayEntry): number {
  if (!isReviewed(entry)) return 0;
  const score = scoreDay(entry);
  return score.total * 100 + (score.sceauZero ? 0 : 50);
}

export function calcStreak(entries: Record<string, DayEntry>): number {
  const today = todayKey();
  let streak = 0;
  let cursor = new Date();

  for (let i = 0; i < 365; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (key > today) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const entry = entries[key];
    if (!entry || !isReviewed(entry)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function calcLevel(totalXP: number): { level: number; xpInLevel: number; xpNeeded: number } {
  const thresholds = [0, 500, 1500, 3000, 5000, 8000, 12000, 17000, 23000, 30000];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (totalXP >= thresholds[i]) {
      level = i + 1;
      break;
    }
  }
  const xpInLevel = totalXP - (thresholds[level - 1] ?? 0);
  const xpNeeded = (thresholds[level] ?? thresholds[thresholds.length - 1]) - (thresholds[level - 1] ?? 0);
  return { level, xpInLevel, xpNeeded };
}

export function calcTotalXP(entries: Record<string, DayEntry>): number {
  return Object.values(entries).reduce((sum, e) => sum + calcXP(e), 0);
}

export function calcAverageScore(entries: Record<string, DayEntry>): number {
  const reviewed = Object.values(entries).filter(isReviewed);
  if (reviewed.length === 0) return 0;
  const total = reviewed.reduce((sum, e) => sum + scoreDay(e).total, 0);
  return total / reviewed.length;
}
