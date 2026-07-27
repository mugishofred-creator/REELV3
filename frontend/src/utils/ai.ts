import type {
  AISettings,
  Application,
  Offer,
  Profile,
} from "../store/context";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export function isAIReady(ai: AISettings): boolean {
  return ai.smartMode && ai.apiKey.trim().length > 10;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chat(
  ai: AISettings,
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!isAIReady(ai)) throw new Error("IA non configurée");
  const body: Record<string, unknown> = {
    model: ai.model || "gpt-4o-mini",
    messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ai.apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 160)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

function safeJSON<T>(raw: string, fallback: T): T {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}

export interface AIOfferScore {
  score: number;
  reasons: string[];
  redFlags: string[];
  fitSummary: string;
}

export async function scoreOfferAI(
  ai: AISettings,
  profile: Profile,
  offer: Offer
): Promise<AIOfferScore> {
  const sys =
    "Tu es un coach emploi. Tu évalues la pertinence d'une offre pour un candidat. Réponds STRICTEMENT en JSON valide.";
  const user = `PROFIL:
Nom: ${profile.fullName || "—"}
Poste cible: ${profile.headline || "—"}
Niveau: ${profile.educationLevel || "—"} | ${profile.experienceYears} an(s) d'XP
Skills: ${profile.skills.join(", ") || "—"}
Pitch: ${profile.summary || "—"}

OFFRE:
${offer.title} — ${offer.company} (${offer.location}, ${offer.remote})
Contrat: ${offer.contract} | Plateforme: ${offer.platform}
Skills demandés: ${offer.skills.join(", ")}
Description: ${offer.description}

Renvoie un JSON: { "score": number 0-100, "reasons": string[] (3 max, courts), "redFlags": string[] (2 max), "fitSummary": string (1 phrase, max 140 chars) }`;

  const raw = await chat(
    ai,
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { json: true, temperature: 0.2, maxTokens: 400 }
  );
  const parsed = safeJSON<Partial<AIOfferScore>>(raw, {});
  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
    reasons: parsed.reasons ?? [],
    redFlags: parsed.redFlags ?? [],
    fitSummary: parsed.fitSummary ?? "",
  };
}

export async function generateLetterAI(
  ai: AISettings,
  profile: Profile,
  offer: Offer,
  template?: string
): Promise<string> {
  const sys =
    "Tu rédiges des lettres de motivation en français, percutantes, personnalisées, sans cliché. Style direct, concret, première personne. 180-220 mots maximum.";
  const user = `Rédige la lettre pour:
CANDIDAT:
- ${profile.fullName || "[Nom]"} — ${profile.headline || "candidat"}
- Skills: ${profile.skills.join(", ") || "—"}
- Pitch: ${profile.summary || "—"}
- Expérience: ${profile.experienceYears} an(s)

OFFRE:
- ${offer.title} chez ${offer.company} (${offer.location})
- Contrat: ${offer.contract}
- Skills demandés: ${offer.skills.join(", ")}
- Description: ${offer.description}

${template ? `Inspire-toi de ce ton mais personnalise totalement:\n${template}\n\n` : ""}Règles:
- Une accroche concrète liée à ${offer.company} (pas "je suis passionné par votre entreprise")
- Mets en avant 2-3 skills qui matchent l'offre, avec un exemple bref
- Termine par une dispo claire pour échanger
- Pas de placeholder type [Votre nom] : utilise les vraies infos`;

  return chat(
    ai,
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { temperature: 0.7, maxTokens: 600 }
  );
}

export interface CVOptimization {
  atsScore: number;
  strengths: string[];
  improvements: string[];
  missingKeywords: string[];
}

export async function optimizeCVAI(
  ai: AISettings,
  profile: Profile,
  cvText: string,
  targetOffer?: Offer
): Promise<CVOptimization> {
  const sys =
    "Tu es un expert ATS. Tu analyses un CV et tu renvoies un score ATS et des recommandations concrètes. Réponds STRICTEMENT en JSON.";
  const user = `CIBLE: ${profile.headline || "—"}
${targetOffer ? `OFFRE TYPE: ${targetOffer.title} chez ${targetOffer.company}\nSkills demandés: ${targetOffer.skills.join(", ")}\n` : ""}
CV (texte brut):
${cvText.slice(0, 6000)}

Renvoie un JSON: { "atsScore": number 0-100, "strengths": string[] (3 max), "improvements": string[] (4 max, actionnables), "missingKeywords": string[] (5 max) }`;

  const raw = await chat(
    ai,
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { json: true, temperature: 0.3, maxTokens: 600 }
  );
  const parsed = safeJSON<Partial<CVOptimization>>(raw, {});
  return {
    atsScore: Math.max(0, Math.min(100, Math.round(parsed.atsScore ?? 0))),
    strengths: parsed.strengths ?? [],
    improvements: parsed.improvements ?? [],
    missingKeywords: parsed.missingKeywords ?? [],
  };
}

export interface FakeOfferAnalysis {
  isFake: boolean;
  confidence: number;
  reasons: string[];
}

export async function detectFakeOfferAI(
  ai: AISettings,
  offer: Offer
): Promise<FakeOfferAnalysis> {
  const sys =
    "Tu détectes les fausses offres d'emploi (arnaques, MLM, ghost jobs). Réponds STRICTEMENT en JSON.";
  const user = `Offre:
${offer.title} chez ${offer.company} (${offer.location})
Contrat: ${offer.contract}, Salaire: ${offer.salaryMin ?? "?"} - ${offer.salaryMax ?? "?"}
Description: ${offer.description}

Renvoie JSON: { "isFake": boolean, "confidence": number 0-1, "reasons": string[] (3 max) }`;

  const raw = await chat(
    ai,
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { json: true, temperature: 0.1, maxTokens: 300 }
  );
  const parsed = safeJSON<Partial<FakeOfferAnalysis>>(raw, {});
  return {
    isFake: !!parsed.isFake,
    confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
    reasons: parsed.reasons ?? [],
  };
}

export interface StrategicAdvice {
  headline: string;
  insights: string[];
  nextActions: string[];
}

export async function strategicAdviceAI(
  ai: AISettings,
  profile: Profile,
  applications: Application[]
): Promise<StrategicAdvice> {
  const summary = {
    total: applications.length,
    envoyees: applications.filter((a) => a.status !== "file").length,
    entretiens: applications.filter((a) => a.status === "entretien" || a.status === "offre").length,
    refus: applications.filter((a) => a.status === "refus").length,
    topPlatforms: topCount(applications.map((a) => a.offer.platform)),
    topContracts: topCount(applications.map((a) => a.offer.contract)),
  };
  const sys =
    "Tu es un coach emploi data-driven. Tu analyses la perf des candidatures et tu sors des recos stratégiques. Réponds STRICTEMENT en JSON.";
  const user = `PROFIL:
Poste cible: ${profile.headline || "—"}
XP: ${profile.experienceYears} ans
Skills: ${profile.skills.join(", ") || "—"}

STATS CANDIDATURES:
${JSON.stringify(summary, null, 2)}

Renvoie JSON: { "headline": string (1 phrase punchy), "insights": string[] (3 max), "nextActions": string[] (3 max, actionnables et concrètes) }`;

  const raw = await chat(
    ai,
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { json: true, temperature: 0.5, maxTokens: 500 }
  );
  const parsed = safeJSON<Partial<StrategicAdvice>>(raw, {});
  return {
    headline: parsed.headline ?? "",
    insights: parsed.insights ?? [],
    nextActions: parsed.nextActions ?? [],
  };
}

function topCount(arr: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  arr.forEach((x) => {
    out[x] = (out[x] ?? 0) + 1;
  });
  return out;
}
