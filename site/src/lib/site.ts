export const site = {
  name: "LORD FORGIVE ME",
  short: "LFM",
  tagline: "WE WEAR OUR SINS.",
  drop: "DROP 001",
  /** Override with NEXT_PUBLIC_SITE_URL in production. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://lordforgiveme.com",
  description:
    "LORD FORGIVE ME — we wear our sins. Drop 001: SINS and CLOUD. A clothing house built on what we carry and what we look toward.",
  instagram: "https://instagram.com/",
} as const;

/** The arc the brand is telling. Only two chapters are open. */
export const chapters = [
  { id: "heaven", title: "HEAVEN", state: "past" },
  { id: "fall", title: "FALL", state: "past" },
  { id: "sins", title: "SINS", state: "open" },
  { id: "cloud", title: "CLOUD", state: "open" },
  { id: "forgiveness", title: "FORGIVENESS", state: "sealed" },
] as const;
