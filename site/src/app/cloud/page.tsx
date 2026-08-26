import type { Metadata } from "next";
import { CollectionView } from "@/components/CollectionView";
import { collections } from "@/lib/products";

export const metadata: Metadata = {
  title: "CLOUD — What we look toward",
  description: `${collections.cloud.line} ${collections.cloud.story[0]}`,
  alternates: { canonical: "/cloud" },
};

export default function CloudPage() {
  return <CollectionView id="cloud" />;
}
