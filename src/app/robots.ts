import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const isPublicLaunch = process.env.NEXT_PUBLIC_SITE_MODE === "production";

export default function robots(): MetadataRoute.Robots {
  // Affiliate redirects and event endpoints must never be crawled.
  return {
    rules: isPublicLaunch
      ? [{ userAgent: "*", allow: "/", disallow: ["/go/", "/api/"] }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
