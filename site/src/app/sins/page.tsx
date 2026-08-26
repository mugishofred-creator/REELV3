import type { Metadata } from "next";
import { CollectionView } from "@/components/CollectionView";
import { collections } from "@/lib/products";

export const metadata: Metadata = {
  title: "SINS — What we carry",
  description: `${collections.sins.line} ${collections.sins.story[0]}`,
  alternates: { canonical: "/sins" },
};

export default function SinsPage() {
  return <CollectionView id="sins" />;
}
