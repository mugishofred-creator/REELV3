export type TemplateCategory = "refus" | "negociation" | "port" | "lot" | "relance";

export type MessageTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  content: string;
};

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "t1",
    name: "Prix ferme",
    category: "refus",
    content: "Bonjour @{pseudo} ! Je ne peux malheureusement pas descendre en dessous de {prix}€, c'est mon prix minimum. N'hésite pas si tu changes d'avis 😊",
  },
  {
    id: "t2",
    name: "Contre-offre",
    category: "negociation",
    content: "Bonjour @{pseudo} ! Je peux te faire à {contre}€ port inclus, mais c'est mon dernier prix. L'article est en parfait état comme tu peux le voir sur les photos 👌",
  },
  {
    id: "t3",
    name: "Port offert",
    category: "port",
    content: "Bonjour @{pseudo} ! Je t'offre le port si tu prends l'article à {prix}€ 🚀 C'est une belle affaire !",
  },
  {
    id: "t4",
    name: "Relance 24h",
    category: "relance",
    content: "Bonjour @{pseudo} ! Je voulais te relancer concernant {produit}. L'article est encore dispo, tu es toujours intéressé(e) ? 😊",
  },
  {
    id: "t5",
    name: "Lot groupé",
    category: "lot",
    content: "Bonjour @{pseudo} ! Si tu prends plusieurs articles, je te fais une remise groupée. Qu'est-ce qui t'intéresse d'autre dans ma boutique ? 👀",
  },
  {
    id: "t6",
    name: "Refus offre basse",
    category: "refus",
    content: "Bonjour @{pseudo} ! {offre}€ c'est trop bas par rapport à ce que j'ai payé. Je peux descendre à {contre}€ maximum. Bonne continuation 🙏",
  },
];

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  refus: "Refus",
  negociation: "Négociation",
  port: "Port",
  lot: "Lot",
  relance: "Relance",
};

export function fillTemplate(tpl: MessageTemplate, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [k, v]) => msg.replace(new RegExp(`\\{${k}\\}`, "g"), v),
    tpl.content
  );
}
