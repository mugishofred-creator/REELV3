import Image from "next/image";
import type { Product } from "@/lib/products";
import { Artwork } from "./Artwork";
import styles from "./ProductVisual.module.css";

/** Artwork width per piece, so a crown and a sigil do not sit at the same scale. */
const SCALE: Record<Product["artwork"], string> = {
  "lf-mark": "34%",
  crown: "72%",
  star: "44%",
  stars: "62%",
  eyes: "78%",
};

/**
 * Until the campaign shoot lands, each piece is shown as its artwork on a plate.
 * Give a product `images` and the photograph takes over with no other change.
 */
export function ProductVisual({
  product,
  sizes = "(min-width: 60rem) 33vw, 90vw",
  priority = false,
}: {
  product: Product;
  sizes?: string;
  priority?: boolean;
}) {
  const photo = product.images?.[0];

  return (
    <div className={styles.plate} style={{ ["--art-width" as string]: product.artScale ?? SCALE[product.artwork] }}>
      {photo ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={styles.photo}
        />
      ) : (
        <Artwork
          name={product.artwork}
          sizes={sizes}
          priority={priority}
          className={styles.art}
        />
      )}
    </div>
  );
}

export { SCALE as artworkScale };
