import type { Metadata } from "next";
import { ActionLink } from "@/components/Action";
import { Artwork } from "@/components/Artwork";
import { Reveal } from "@/components/Reveal";
import { Star } from "@/components/Star";
import { site } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "The world — Heaven, Fall, Sins, Forgiveness",
  description:
    "The story behind Lord Forgive Me: heaven, the fall, the sins we wear, and a forgiveness that has not opened yet.",
  alternates: { canonical: "/world" },
};

const ARC = [
  {
    numeral: "I",
    title: "Heaven",
    state: null,
    body: [
      "Everything starts clean. Nobody stays there.",
      "We keep the light in the house because we remember standing in it.",
    ],
  },
  {
    numeral: "II",
    title: "Fall",
    state: null,
    body: [
      "The fall is not a punishment. It is the first honest moment.",
      "It is where the weight is handed to you, and where you decide whether to hide it.",
    ],
  },
  {
    numeral: "III",
    title: "Sins",
    state: "Open now",
    body: [
      "We do not hide it. We wear it.",
      "SINS is the plain half of the house: cotton, restraint, a mark small enough to be a private matter.",
    ],
  },
  {
    numeral: "IV",
    title: "Cloud",
    state: "Open now",
    body: [
      "Carrying something and looking up are the same gesture.",
      "CLOUD is the sky half: angels, stars, the light above the ceiling. A direction, not an apology.",
    ],
  },
  {
    numeral: "V",
    title: "Forgiveness",
    state: "Sealed",
    body: [
      "Forgiveness is not in this drop.",
      "It is not refused. It is not yet. Carry the first two chapters long enough and the last one opens.",
    ],
  },
] as const;

export default function WorldPage() {
  return (
    <>
      <header className={styles.head}>
        <Artwork name="stars" sizes="(min-width: 56rem) 15rem, 30vw" priority className={styles.art} />
        <div className={styles.core}>
          <p className="label">The world of {site.name}</p>
          <h1 className={`gothic chrome-text ${styles.title}`}>We wear our sins.</h1>
          <p className="line">Heaven. Fall. Sins. Cloud. Forgiveness.</p>
        </div>
      </header>

      <section className="shell">
        <div className={styles.chapters}>
          {ARC.map((chapter) => (
            <Reveal key={chapter.title} className={styles.chapter}>
              <p className={styles.numeral}>{chapter.numeral}</p>
              <h2 className={`gothic chrome-text ${styles.name}`}>{chapter.title}</h2>
              <div className={styles.body}>
                {chapter.state && (
                  <p className={styles.state}>
                    <Star size={8} />
                    {chapter.state}
                  </p>
                )}
                {chapter.body.map((paragraph) => (
                  <p key={paragraph} className="prose">
                    {paragraph}
                  </p>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="shell">
        <Reveal className={styles.close}>
          <p className="line">Two chapters are open.</p>
          <ActionLink href="/shop" inline>
            Enter Drop 001
          </ActionLink>
        </Reveal>
      </section>
    </>
  );
}
