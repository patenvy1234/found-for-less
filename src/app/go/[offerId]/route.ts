import { getOfferById } from "@/data/catalog";
import { allowedHosts, resolveAffiliateUrl } from "@/lib/affiliate";

const MAX_EVENT_VALUE_LENGTH = 120;

function cleanEventValue(value: string | null) {
  return value?.trim().slice(0, MAX_EVENT_VALUE_LENGTH) || undefined;
}

function isAllowedDestination(url: URL, allowedDomains: readonly string[]) {
  return (
    url.protocol === "https:" &&
    allowedDomains.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  );
}

export async function GET(
  request: Request,
  context: RouteContext<"/go/[offerId]">,
) {
  const { offerId } = await context.params;
  const offer = getOfferById(offerId);

  if (!offer) {
    return Response.json({ error: "Offer not found" }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const clickId = crypto.randomUUID();
  const link = resolveAffiliateUrl(
    offer.id,
    offer.merchant.id,
    offer.destinationUrl,
    clickId,
  );
  const environmentKey = link.envKey;
  let destination: URL;

  try {
    destination = new URL(link.url);
  } catch {
    console.error(
      JSON.stringify({
        event: "affiliate_destination_invalid",
        offerId,
        environmentKey,
      }),
    );
    return Response.json({ error: "Offer is temporarily unavailable" }, { status: 503 });
  }

  if (!isAllowedDestination(destination, allowedHosts(offer.merchant))) {
    console.error(
      JSON.stringify({
        event: "affiliate_destination_blocked",
        offerId,
        environmentKey,
        destinationHost: destination.hostname,
      }),
    );
    return Response.json({ error: "Offer is temporarily unavailable" }, { status: 503 });
  }

  console.info(
    JSON.stringify({
      event: "affiliate_click",
      clickId,
      occurredAt: new Date().toISOString(),
      offerId: offer.id,
      productId: offer.product.id,
      merchant: offer.merchant.name,
      matchBasis: offer.matchBasis,
      linkSource: link.source,
      placement: cleanEventValue(requestUrl.searchParams.get("placement")),
      campaign: cleanEventValue(requestUrl.searchParams.get("campaign")),
    }),
  );

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Location: destination.toString(),
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Click-Id": clickId,
    },
  });
}