import { affiliateEnvKey, merchants, products } from "@/data/catalog";
import { sellerTemplateEnvKey } from "@/lib/affiliate";

// Generates a .env template for monetising every seller.
// Disabled in production so the catalogue layout is not exposed publicly.
const isPublicLaunch = process.env.NEXT_PUBLIC_SITE_MODE === "production";

const HEADER = `# Affiliate configuration
#
# Two ways to monetise, checked in this order:
#   1. AFFILIATE_URL_<OFFER_ID>        one specific offer, overrides everything
#   2. AFFILIATE_TEMPLATE_<SELLER>     every offer for that seller
#
# Placeholders available in both:
#   {{url}}          the seller product/search URL held in the catalogue
#   {{url_encoded}}  the same URL, percent-encoded for network wrappers
#   {{click_id}}     per-click UUID, put it in the network's sub-ID field
#
# Two shapes cover almost every Indian network:
#   Wrapper   AFFILIATE_TEMPLATE_MYNTRA=https://network.example/r?id=YOURID&url={{url_encoded}}&subid={{click_id}}
#   Parameter AFFILIATE_TEMPLATE_AMAZON=https://www.amazon.in/s?k=example&tag=YOURTAG
#
# A wrapper sends users via the network's own domain, so list those domains here
# or the redirect is blocked as an open-redirect risk.
`;

export async function GET() {
  if (isPublicLaunch) {
    return new Response("Not found", { status: 404 });
  }

  const offerCounts = new Map<string, number>();
  for (const product of products) {
    for (const offer of product.offers) {
      offerCounts.set(offer.merchantId, (offerCounts.get(offer.merchantId) ?? 0) + 1);
    }
  }

  const networkLine = [
    "# Comma-separated network redirect domains you have been approved for.",
    `AFFILIATE_NETWORK_DOMAINS=${process.env.AFFILIATE_NETWORK_DOMAINS ?? ""}`,
  ].join("\n");

  const sellerBlocks = merchants.map((merchant) => {
    const key = sellerTemplateEnvKey(merchant.id);
    const configured = process.env[key];
    const count = offerCounts.get(merchant.id) ?? 0;

    return [
      `# ${merchant.name} — ${count} offer${count === 1 ? "" : "s"} · direct domain ${merchant.domains.join(", ")}`,
      configured ? `${key}=${configured}` : `# ${key}=`,
    ].join("\n");
  });

  const overrideBlocks = products.flatMap((product) =>
    product.offers.map((offer) => {
      const key = affiliateEnvKey(offer.id);
      const configured = process.env[key];
      return configured
        ? `${key}=${configured}`
        : `# ${key}=   # ${product.name}`;
    }),
  );

  const configuredSellers = merchants.filter(
    (merchant) => process.env[sellerTemplateEnvKey(merchant.id)],
  ).length;

  const body = [
    HEADER,
    networkLine,
    "",
    `# ---- Seller templates (${configuredSellers}/${merchants.length} configured) ----`,
    "",
    sellerBlocks.join("\n\n"),
    "",
    `# ---- Per-offer overrides (${overrideBlocks.length}, only for exceptions) ----`,
    "",
    overrideBlocks.join("\n"),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
