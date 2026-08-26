import Image from "next/image";
import { asset } from "@/lib/asset";
import type { ArtworkKey } from "@/lib/products";
import styles from "./Artwork.module.css";

const SOURCES: Record<ArtworkKey, { src: string; width: number; height: number }> = {
  "lf-mark": { src: asset("/brand/lf-mark.webp"), width: 1000, height: 1250 },
  crown: { src: asset("/brand/crown.webp"), width: 1400, height: 933 },
  star: { src: asset("/brand/star.webp"), width: 900, height: 1350 },
  stars: { src: asset("/brand/stars.webp"), width: 1000, height: 1000 },
  eyes: { src: asset("/brand/eyes.webp"), width: 1500, height: 844 },
};

/** Brand artwork sits in the dark: screen blend, never a box on a box. */
export function Artwork({
  name,
  alt = "",
  sizes = "100vw",
  priority = false,
  className,
}: {
  name: ArtworkKey;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const source = SOURCES[name];
  const isGold = name === "lf-mark";
  return (
    <Image
      src={source.src}
      alt={alt}
      width={source.width}
      height={source.height}
      sizes={sizes}
      priority={priority}
      /* The gold mark is cut out already — blending it would grey it. */
      className={[isGold ? "" : "artwork", styles.image, className].filter(Boolean).join(" ")}
    />
  );
}
