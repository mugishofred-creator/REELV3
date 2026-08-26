import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductVisual } from "@/components/ProductVisual";
import { Reveal } from "@/components/Reveal";
import { formatPrice } from "@/lib/money";
import { collections, getAllProducts, getProduct, getProductsByCollection } from "@/lib/products";
import { site } from "@/lib/site";
import styles from "./page.module.css";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: `${product.line} ${product.notes}`,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      title: `${product.name} — ${site.name}`,
      description: product.notes,
      url: `/shop/${product.slug}`,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const collection = collections[product.collection];
  const rest = getProductsByCollection(product.collection)
    .filter((item) => item.slug !== product.slug)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.notes,
    brand: { "@type": "Brand", name: site.name },
    category: collection.title,
    offers: {
      "@type": "Offer",
      price: (product.price / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: "https://schema.org/PreOrder",
      url: `${site.url}/shop/${product.slug}`,
    },
  };

  return (
    <div className={`shell ${styles.wrap}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/shop" className={styles.back}>
        Back to Drop 001
      </Link>

      <div className={styles.product}>
        <ProductVisual product={product} sizes="(min-width: 56rem) 55vw, 100vw" priority />

        <div className={styles.info}>
          <p className={styles.collection}>
            <Link href={`/${collection.id}`}>{collection.title}</Link> — {collection.prompt}
          </p>
          <h1 className={styles.name}>{product.name}</h1>
          <p className={styles.price}>{formatPrice(product.price, product.currency)}</p>
          <p className={styles.line}>{product.line}</p>

          <AddToCart product={product} />

          <p className="prose">{product.notes}</p>

          <ul className={styles.details}>
            {product.details.map((detail) => (
              <li key={detail} className={styles.detail}>
                {detail}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {rest.length > 0 && (
        <section className="chapter">
          <div className={styles.more}>
            <Reveal>
              <h2 className="label">More from {collection.title}</h2>
            </Reveal>
            <ProductGrid products={rest} showCollection={false} />
          </div>
        </section>
      )}
    </div>
  );
}
