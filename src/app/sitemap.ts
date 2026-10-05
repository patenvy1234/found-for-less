import type { MetadataRoute } from "next";
import { products } from "@/data/catalog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: siteUrl, lastModified: now, changeFrequency: "hourly", priority: 1 },
    {
      url: `${siteUrl}/alerts`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...products.map((product) => ({
      url: `${siteUrl}/p/${product.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
