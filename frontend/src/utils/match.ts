import type { Filters, Offer, Profile } from "../store/context";

const FAKE_KEYWORDS = [
  "gain rapide",
  "argent facile",
  "travail à domicile garanti",
  "pas d'expérience requise",
  "revenus illimités",
  "mlm",
  "marketing relationnel",
  "rejoignez notre réseau",
  "investissement minimum",
];

export interface OfferScore {
  score: number;
  reasons: string[];
  redFlags: string[];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function tokenize(input: string): string[] {
  return normalize(input)
    .split(/[^a-z0-9+#.]+/)
    .filter((x) => x.length > 1);
}

export function scoreOfferHeuristic(
  offer: Offer,
  profile: Profile,
  filters: Filters
): OfferScore {
  const reasons: string[] = [];
  const redFlags: string[] = [];
  let score = 30;

  const headlineTokens = tokenize(profile.headline);
  const titleTokens = tokenize(offer.title);
  const titleHit = headlineTokens.some((h) => titleTokens.includes(h));
  if (titleHit) {
    score += 18;
    reasons.push("Le poste matche ton intitulé cible");
  }

  const profileSkills = new Set(profile.skills.map((s) => normalize(s)));
  const offerSkills = offer.skills.map((s) => normalize(s));
  const skillsHit = offerSkills.filter((s) => profileSkills.has(s));
  if (skillsHit.length > 0) {
    const bonus = Math.min(20, skillsHit.length * 6);
    score += bonus;
    reasons.push(`${skillsHit.length} skill(s) en commun avec ton profil`);
  } else if (profile.skills.length > 0) {
    score -= 5;
    redFlags.push("Aucune compétence en commun avec ton CV");
  }

  if (filters.location) {
    const locOk =
      normalize(offer.location).includes(normalize(filters.location)) ||
      offer.remote === "Télétravail";
    if (locOk) {
      score += 8;
      reasons.push("Localisation compatible");
    } else {
      score -= 6;
    }
  }

  if (filters.contracts.length > 0) {
    if (filters.contracts.includes(offer.contract)) {
      score += 6;
    } else {
      score -= 10;
      redFlags.push(`Contrat ${offer.contract} hors de tes préférences`);
    }
  }

  if (filters.remote.length > 0) {
    if (filters.remote.includes(offer.remote)) {
      score += 4;
    } else {
      score -= 4;
    }
  }

  const salaryFloor = Math.max(filters.salaryMin, profile.salaryMin);
  if (salaryFloor > 0 && offer.salaryMax) {
    if (offer.salaryMax >= salaryFloor) {
      score += 4;
    } else {
      score -= 8;
      redFlags.push("Salaire sous ton minimum");
    }
  }

  if (filters.keywords) {
    const kw = tokenize(filters.keywords);
    const haystack = normalize(`${offer.title} ${offer.description}`);
    const matches = kw.filter((k) => haystack.includes(k));
    if (matches.length > 0) {
      score += Math.min(10, matches.length * 3);
      reasons.push(`Mots-clés: ${matches.join(", ")}`);
    } else if (kw.length > 0) {
      score -= 4;
    }
  }

  if (offer.postedDaysAgo <= 3) {
    score += 5;
    reasons.push("Offre fraîche, postule en premier");
  } else if (offer.postedDaysAgo >= 21) {
    score -= 5;
    redFlags.push("Annonce ancienne (>3 sem)");
  }

  if (profile.experienceYears <= 2) {
    if (offer.contract === "Stage" || offer.contract === "Alternance" || offer.highlight === "junior") {
      score += 8;
      reasons.push("Adapté aux profils juniors");
    }
  }

  const fakeHits = detectFakeKeywords(offer.description);
  if (fakeHits.length > 0) {
    score -= 25;
    redFlags.push(`Signaux suspects: ${fakeHits.slice(0, 2).join(", ")}`);
  }

  if (!offer.salaryMin && !offer.salaryMax) {
    redFlags.push("Pas de fourchette salariale annoncée");
    score -= 3;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons, redFlags };
}

export function detectFakeKeywords(text: string): string[] {
  const hay = normalize(text);
  return FAKE_KEYWORDS.filter((k) => hay.includes(normalize(k)));
}

export function applyHardFilters(offers: Offer[], filters: Filters): Offer[] {
  return offers.filter((o) => {
    if (filters.platforms.length > 0 && !filters.platforms.includes(o.platform)) return false;
    if (filters.contracts.length > 0 && !filters.contracts.includes(o.contract)) return false;
    if (filters.remote.length > 0 && !filters.remote.includes(o.remote)) return false;
    if (filters.salaryMin > 0 && o.salaryMax && o.salaryMax < filters.salaryMin) return false;
    if (filters.location) {
      const ok =
        normalize(o.location).includes(normalize(filters.location)) ||
        o.remote === "Télétravail";
      if (!ok) return false;
    }
    if (filters.keywords) {
      const kw = tokenize(filters.keywords);
      const hay = normalize(`${o.title} ${o.description} ${o.skills.join(" ")}`);
      const matched = kw.some((k) => hay.includes(k));
      if (!matched) return false;
    }
    if (filters.excludeFakeOffers && detectFakeKeywords(o.description).length > 0) return false;
    return true;
  });
}

export function scoreColor(score: number): "good" | "warning" | "urgent" {
  if (score >= 70) return "good";
  if (score >= 45) return "warning";
  return "urgent";
}
