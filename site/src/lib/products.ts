/**
 * DROP 001 catalogue.
 *
 * This file is the only place the shop knows about inventory. Swapping it for a
 * Shopify / Stripe / headless backend means replacing the four query functions
 * at the bottom — nothing in the UI reads the array directly.
 */

export type CollectionId = "sins" | "cloud";

/** Keys of the artwork shipped in /public/brand. */
export type ArtworkKey = "lf-mark" | "crown" | "star" | "stars" | "eyes";

export type Product = {
  slug: string;
  name: string;
  collection: CollectionId;
  /** Minor units, e.g. 6500 = 65,00 €. */
  price: number;
  currency: "EUR";
  sizes: string[];
  /** One fragment. Never a sentence more than it needs. */
  line: string;
  notes: string;
  details: string[];
  artwork: ArtworkKey;
  /** Overrides the default plate scale — two pieces may share a symbol, not a print. */
  artScale?: string;
  /** Real photography drops in here later; the artwork plate is the stand-in. */
  images?: { src: string; alt: string }[];
};

export type Collection = {
  id: CollectionId;
  title: string;
  /** The question the collection answers. */
  prompt: string;
  line: string;
  story: string[];
  artwork: ArtworkKey;
  index: string;
};

export const collections: Record<CollectionId, Collection> = {
  sins: {
    id: "sins",
    title: "SINS",
    prompt: "WHAT WE CARRY.",
    line: "WE WEAR OUR SINS.",
    story: [
      "Everyone leaves the house already carrying something. A thing said. A thing taken. A thing left undone.",
      "SINS does not hide it. The weight goes on the outside — plain cotton, plain cut, the mark small enough that only the people who know, know.",
      "This is the quiet half of the house. Wear it every day. That is the point.",
    ],
    artwork: "eyes",
    index: "I",
  },
  cloud: {
    id: "cloud",
    title: "CLOUD",
    prompt: "WHAT WE LOOK TOWARD.",
    line: "WE STILL LOOK UP.",
    story: [
      "Nobody carries a weight without looking for somewhere to set it down.",
      "CLOUD is the sky half — angels, stars, the light on the other side of the ceiling. Larger artwork, more air, the same restraint.",
      "It is not an apology. It is a direction.",
    ],
    artwork: "star",
    index: "II",
  },
};

const catalogue: Product[] = [
  {
    slug: "we-wear-our-sins-tee",
    name: "WE WEAR OUR SINS TEE",
    collection: "sins",
    price: 6500,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "THE SENTENCE, WORN.",
    notes:
      "The house statement across the back, set small and wide. Front carries the LF sigil at the heart, nothing else.",
    details: [
      "240 GSM combed cotton, garment washed",
      "Boxy body, dropped shoulder",
      "Puff print, back — screen print, chest",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "lf-mark",
  },
  {
    slug: "lf-sigil-hoodie",
    name: "LF SIGIL HOODIE",
    collection: "sins",
    price: 14500,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "HEAVY, AS IT SHOULD BE.",
    notes:
      "The sigil sits alone on the chest in chrome-grey. Everything else is left empty on purpose.",
    details: [
      "420 GSM brushed back fleece",
      "Double-lined hood, ribbed cuffs",
      "Embroidered sigil, chest",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "lf-mark",
  },
  {
    slug: "confession-longsleeve",
    name: "CONFESSION LONGSLEEVE",
    collection: "sins",
    price: 8500,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "SAID ONCE. WORN OFTEN.",
    notes:
      "Four-point stars run down both sleeves. Read from the wrist up, they spell nothing. That is the joke.",
    details: [
      "220 GSM ringspun cotton",
      "Regular body, long sleeve",
      "Sleeve print, both arms",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "stars",
  },
  {
    slug: "crown-of-faults-tee",
    name: "CROWN OF FAULTS TEE",
    collection: "sins",
    price: 7000,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "EVERY ONE OF US, CROWNED.",
    notes:
      "The chrome crown, printed large on the back. It is not a trophy. It is what the weight looks like from behind.",
    details: [
      "240 GSM combed cotton, garment washed",
      "Boxy body, dropped shoulder",
      "Full back print",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "crown",
  },
  {
    slug: "north-star-tee",
    name: "NORTH STAR TEE",
    collection: "cloud",
    price: 6500,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "ONE POINT TO STEER BY.",
    notes:
      "A single four-point star, chrome, centred on the chest. The smallest piece in CLOUD and the one we would keep.",
    details: [
      "240 GSM combed cotton, garment washed",
      "Boxy body, dropped shoulder",
      "Chrome-effect print, chest",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "star",
  },
  {
    slug: "heavens-edge-hoodie",
    name: "HEAVEN'S EDGE HOODIE",
    collection: "cloud",
    price: 15000,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "THE CEILING, OPENED.",
    notes:
      "Cloud field printed edge to edge across the back, fading before it reaches the hem. Chest left bare.",
    details: [
      "420 GSM brushed back fleece",
      "Double-lined hood, ribbed cuffs",
      "Oversized back print, fade finish",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "stars",
  },
  {
    slug: "ascension-zip-hood",
    name: "ASCENSION ZIP HOOD",
    collection: "cloud",
    price: 16500,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "FOR THE WAY UP.",
    notes:
      "Stars climb one side of the zip and stop at the shoulder. The piece finishes where the wearer does.",
    details: [
      "400 GSM loopback cotton, full zip",
      "Relaxed body, ribbed hem",
      "Embroidery, left placket to shoulder",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "stars",
    artScale: "38%",
  },
  {
    slug: "mourning-sky-tee",
    name: "MOURNING SKY TEE",
    collection: "cloud",
    price: 7000,
    currency: "EUR",
    sizes: ["S", "M", "L", "XL"],
    line: "THE SKY CRIES FIRST.",
    notes:
      "The only piece that belongs to both halves of the house. Eyes on the front, sky on the back, one tear between them.",
    details: [
      "240 GSM combed cotton, garment washed",
      "Boxy body, dropped shoulder",
      "Front and back print",
      "Wash cold. Inside out. Hang dry.",
    ],
    artwork: "eyes",
  },
];

/* ---------------------------------------------------------------- */
/* Queries — the seam a real backend replaces                        */
/* ---------------------------------------------------------------- */

export function getAllProducts(): Product[] {
  return catalogue;
}

export function getProductsByCollection(id: CollectionId): Product[] {
  return catalogue.filter((product) => product.collection === id);
}

export function getProduct(slug: string): Product | undefined {
  return catalogue.find((product) => product.slug === slug);
}

export function getFeatured(count = 4): Product[] {
  const sins = getProductsByCollection("sins");
  const cloud = getProductsByCollection("cloud");
  const woven: Product[] = [];
  for (let i = 0; woven.length < count && (i < sins.length || i < cloud.length); i += 1) {
    if (sins[i]) woven.push(sins[i]);
    if (cloud[i] && woven.length < count) woven.push(cloud[i]);
  }
  return woven;
}
