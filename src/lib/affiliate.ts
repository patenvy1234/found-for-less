import { affiliateEnvKey, type Merchant } from "@/data/catalog";

export type LinkSource = "offer-override" | "seller-template" | "unmonetised";

export type ResolvedLink = {
  url: string;
  source: LinkSource;
  envKey?: string;
};

/** Per-seller template, e.g. AFFILIATE_TEMPLATE_FLIPKART. */
export function sellerTemplateEnvKey(merchantId: string) {
  return `AFFILIATE_TEMPLATE_${merchantId.replaceAll("-", "_").toUpperCase()}`;
}

function fill(template: string, destinationUrl: string, clickId: string) {
  return template
    .replaceAll("{{url_encoded}}", encodeURIComponent(destinationUrl))
    .replaceAll("{{url}}", destinationUrl)
    .replaceAll("{{click_id}}", clickId);
}

/**
 * Offer override wins, then the seller template, then the plain merchant URL.
 * Only the first two earn commission.
 */
export function resolveAffiliateUrl(
  offerId: string,
  merchantId: string,
  destinationUrl: string,
  clickId: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedLink {
  const offerKey = affiliateEnvKey(offerId);
  const offerOverride = env[offerKey];
  if (offerOverride) {
    return {
      url: fill(offerOverride, destinationUrl, clickId),
      source: "offer-override",
      envKey: offerKey,
    };
  }

  const templateKey = sellerTemplateEnvKey(merchantId);
  const template = env[templateKey];
  if (template) {
    return {
      url: fill(template, destinationUrl, clickId),
      source: "seller-template",
      envKey: templateKey,
    };
  }

  return { url: destinationUrl, source: "unmonetised" };
}

/**
 * Network wrappers redirect via their own domain, so those hosts must be
 * allow-listed explicitly rather than inferred from the seller.
 */
export function allowedHosts(merchant: Merchant, env: NodeJS.ProcessEnv = process.env) {
  const networkDomains = (env.AFFILIATE_NETWORK_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return [...merchant.domains, ...networkDomains];
}
