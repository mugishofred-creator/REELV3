import type { Metadata, Viewport } from "next";
import { Grenze_Gotisch, Inter } from "next/font/google";
import { CartDrawer } from "@/components/CartDrawer";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MainRegion } from "@/components/MainRegion";
import { Veil } from "@/components/Veil";
import { CartProvider } from "@/lib/cart";
import { ExperienceProvider } from "@/lib/experience";
import { site } from "@/lib/site";
import "./globals.css";

const gothic = Grenze_Gotisch({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-grenze",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: ["Lord Forgive Me", "we wear our sins", "drop 001", "sins", "cloud", "streetwear"],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: site.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${gothic.variable} ${sans.variable}`}>
      <body>
        <ExperienceProvider>
          <CartProvider>
            <a className="skip-link" href="#content">
              Skip to content
            </a>
            <Veil />
            <Header />
            <MainRegion>{children}</MainRegion>
            <Footer />
            <CartDrawer />
          </CartProvider>
        </ExperienceProvider>
      </body>
    </html>
  );
}
