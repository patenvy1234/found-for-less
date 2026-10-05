import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./base.css";
import "./tracker.css";
import "./detail.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const isPublicLaunch = process.env.NEXT_PUBLIC_SITE_MODE === "production";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Found for Less | India Gold & Silver Price Tracker",
    template: "%s | Found for Less",
  },
  description:
    "Compare 24K and 22K gold and 999 silver coins and bars across Indian sellers, with price per gram and premium over the reference rate.",
  applicationName: "Found for Less India Bullion Tracker",
  keywords: [
    "gold price India",
    "silver price India",
    "gold coin price comparison",
    "24K gold rate per gram",
    "silver bar price India",
  ],
  openGraph: {
    title: "Found for Less · India Bullion Tracker",
    description:
      "Gold and silver coins and bars compared per gram, with premium over the reference rate.",
    type: "website",
    locale: "en_IN",
  },
  robots: {
    index: isPublicLaunch,
    follow: isPublicLaunch,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      data-scroll-behavior="smooth"
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
