import type { Letter, Offer, Profile } from "../store/context";

export const DEFAULT_LETTER_TEMPLATE: Letter = {
  id: "default",
  name: "Lettre par défaut",
  isDefault: true,
  createdAt: new Date(0).toISOString(),
  body:
    "Madame, Monsieur,\n\n" +
    "Actuellement à la recherche d'un poste de {{poste}}, je me permets de vous adresser ma candidature pour rejoindre {{entreprise}} à {{ville}}.\n\n" +
    "Mon parcours m'a permis de développer les compétences suivantes : {{skills}}. Ce qui m'attire particulièrement chez {{entreprise}}, c'est l'opportunité de contribuer concrètement à vos projets dès les premières semaines.\n\n" +
    "Je serais ravi(e) d'échanger avec vous lors d'un entretien.\n\n" +
    "Cordialement,\n" +
    "{{nom}}",
};

const PLACEHOLDERS: Record<string, (o: Offer, p: Profile) => string> = {
  poste: (o) => o.title,
  entreprise: (o) => o.company,
  ville: (o) => o.location,
  nom: (_, p) => p.fullName || "[Votre nom]",
  skills: (_, p) => (p.skills.length > 0 ? p.skills.slice(0, 5).join(", ") : "[vos compétences]"),
  experience: (_, p) =>
    p.experienceYears > 0 ? `${p.experienceYears} an(s) d'expérience` : "[expérience]",
  email: (_, p) => p.email || "[email]",
  telephone: (_, p) => p.phone || "[téléphone]",
};

export function renderLetter(
  template: string,
  offer: Offer,
  profile: Profile
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const fn = PLACEHOLDERS[key];
    return fn ? fn(offer, profile) : `[${key}]`;
  });
}

export function pickDefaultLetter(letters: Letter[]): Letter {
  return letters.find((l) => l.isDefault) ?? letters[0] ?? DEFAULT_LETTER_TEMPLATE;
}

export function previewLetter(body: string): string {
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  return lines.slice(0, 2).join(" ").slice(0, 140) + (body.length > 140 ? "…" : "");
}

export const PLACEHOLDER_LIST = Object.keys(PLACEHOLDERS).map((k) => `{{${k}}}`);
