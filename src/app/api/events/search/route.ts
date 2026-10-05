import { categories, merchants, type CategoryId } from "@/data/catalog";

const MAX_BODY_BYTES = 2_048;
const MAX_QUERY_LENGTH = 100;
const validMerchants = new Set<string>(merchants.map((merchant) => merchant.id));
const validCategories = new Set<CategoryId>(
  categories.map((category) => category.id),
);

type SearchEventPayload = {
  query?: unknown;
  category?: unknown;
  merchant?: unknown;
  resultCount?: unknown;
};

function cleanQuery(value: unknown) {
  if (typeof value !== "string") return undefined;

  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function cleanCategory(value: unknown) {
  return typeof value === "string" && validCategories.has(value as CategoryId)
    ? value
    : "all";
}

function cleanMerchant(value: unknown) {
  return typeof value === "string" && validMerchants.has(value)
    ? value
    : "all";
}

function cleanResultCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.min(Math.max(value, 0), 1_000_000)
    : 0;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: SearchEventPayload;
  try {
    payload = (await request.json()) as SearchEventPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = cleanQuery(payload.query);
  const category = cleanCategory(payload.category);
  const merchant = cleanMerchant(payload.merchant);

  if ((!query || query.length < 2) && category === "all" && merchant === "all") {
    return Response.json(
      { error: "A query, category, or merchant is required" },
      { status: 422 },
    );
  }

  console.info(
    JSON.stringify({
      event: "catalog_search",
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      query,
      category,
      merchant,
      resultCount: cleanResultCount(payload.resultCount),
    }),
  );

  return new Response(null, {
    status: 202,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}