# LORD FORGIVE ME

The brand site for **LORD FORGIVE ME** — *we wear our sins.*

The site is not a storefront with a story bolted on. It is the story, and the
storefront is where the story lands. A visitor arrives at a closed door, is
asked one question, and only then sees the house.

    INTRO → WE ALL CARRY SOMETHING → DO YOU CARRY YOURS? → SINS / CLOUD
          → SINS STORY → CLOUD STORY → PIECES → NOW, WEAR IT → SHOP

DROP 001 is two chapters: **SINS** (what we carry) and **CLOUD** (what we look
toward). The arc runs HEAVEN → FALL → SINS → CLOUD → FORGIVENESS, and
FORGIVENESS is deliberately sealed — it is a later drop, not a missing page.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm run start
npm run typecheck
```

## The entry

`src/lib/experience.tsx` is a five-beat state machine:

    mark → name → carry → question → answered → open

The answer is not decoration. YES and NO both let you in — refusing sets
`--warmth: 0` on `<body>`, which cools the chrome, dims the gold sigil and
lowers every piece of artwork on every page for the rest of the visit. The
answer is remembered in `localStorage` (`lfm.entry.v1`), so nobody is made to
knock twice; "Replay the entry" in the footer clears it.

The veil is an overlay on top of a fully server-rendered page. With JavaScript
off, or as a crawler, you get the whole site immediately. `Escape` or "Skip the
entry" leaves at any point, focus moves into the page when the veil lifts, and
`prefers-reduced-motion` shortens every beat and removes the transitions.

## Shape of the code

    src/app/            routes: / /sins /cloud /shop /shop/[slug] /world /cart
    src/components/     Veil, Header, Footer, CartDrawer, ProductCard, …
    src/lib/            products, cart, commerce, experience, money, site
    src/app/globals.css design tokens: one ink, one chrome, one gold

Every route prerenders as static HTML. Metadata, Open Graph, `sitemap.xml`,
`robots.txt` and `Product` structured data are generated from the same catalogue.

## Extending it

**Adding a piece** — one entry in `src/lib/products.ts`. Nothing else needs to
change; the grids, the collection pages, the sitemap and `generateStaticParams`
all read from it.

**Photography** — each piece currently shows its artwork on a dark plate. Give
a product an `images: [{ src, alt }]` array and the photograph takes over the
same slot, in the same aspect ratio, with no other change.

**Checkout** — `src/lib/commerce.ts` is the single seam to a payment provider.
Set `NEXT_PUBLIC_CHECKOUT_ENDPOINT` to a route that turns cart lines into a
hosted checkout (Stripe session, Shopify cart permalink, anything) and returns
`{ url }`. Until that is set, the shop keeps the selection and says plainly
that the drop has not opened — it never pretends to take money.

**Deploying** — set `NEXT_PUBLIC_SITE_URL` so canonical URLs, Open Graph images
and the sitemap point at the real domain.

Every route prerenders, so the site needs no server at all. `STATIC_EXPORT=1`
switches the build to `output: "export"` and writes a plain `out/` folder that
any static host serves. Without it, the full server build runs — image
optimization included — which is what `dev`, `start` and Vercel use.

- **Netlify** — `netlify.toml` at the repo root sets the build command, the
  publish directory and `STATIC_EXPORT`, so connecting the repo is the whole
  setup. Afterwards, set `NEXT_PUBLIC_SITE_URL` in the Netlify environment
  variables to the live address.
- **GitHub Pages** — `.github/workflows/deploy-site.yml` deploys on every push
  that touches `site/`. Project pages live under a subfolder, so the workflow
  also sets `NEXT_PUBLIC_BASE_PATH` to `/<repo>`; that prefix is what routes and
  `/public` assets are built against.

To reproduce either build locally:

```bash
STATIC_EXPORT=1 npm run build && npx http-server out -p 4173
# or, for a subfolder host:
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/REELV3 npm run build
```

## Art direction

One background (`--ink`), one metal (`--chrome`), one accent (`--gold`, used
only for the LF sigil and the sealed chapter). Two typefaces: Grenze Gotisch for
the house name and the chapter titles, Inter for everything else — narrative
fragments are set in wide-tracked uppercase, never in paragraphs.

Symbols are rare on purpose: the LF sigil, the four-point star, the crown, the
eyes. Artwork is composited with `mix-blend-mode: screen` so it sits *in* the
dark rather than on a box on top of it, and it never sits behind a title.

Brand artwork lives in `public/brand/` as WebP with transparency (≈600 KB in
total for the five marks).
