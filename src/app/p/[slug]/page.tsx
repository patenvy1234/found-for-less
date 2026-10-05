import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import {
  benchmark,
  comparableOffers,
  formatWeight,
  getMerchant,
  getProductBySlug,
  historyStats,
  lowestOffer,
  matchBasisLabels,
  pricePerGram,
  productMeta,
  products,
  referenceDelta,
  sellerSpread,
  type PricePoint,
} from "@/data/catalog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const isPublicLaunch = process.env.NEXT_PUBLIC_SITE_MODE === "production";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const clock = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPerGram(value: number) {
  return value >= 100
    ? `₹${Math.round(value).toLocaleString("en-IN")}`
    : `₹${value.toFixed(2)}`;
}

function deltaTone(percent: number) {
  if (percent <= 3) return "good";
  if (percent <= 6) return "fair";
  return "high";
}

const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });

function Sparkline({ series, low }: { series: readonly PricePoint[]; low: number }) {
  const width = 720;
  const height = 120;
  const pad = 6;
  const prices = series.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const coords = series.map((point, index) => {
    const x = pad + (index / (series.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (point.price - min) / range) * (height - pad * 2);
    return { x, y, point };
  });

  const line = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const lowMark = coords.find(({ point }) => point.price === low);

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Ninety day price history, low ${low}`}
    >
      <polygon points={area} fill="rgba(10, 125, 90, 0.09)" />
      <polyline points={line} fill="none" stroke="#0a7d5a" strokeWidth="2" />
      {lowMark && <circle cx={lowMark.x} cy={lowMark.y} r="4" fill="#0a7d5a" />}
    </svg>
  );
}

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(
  { params }: PageProps<"/p/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) return { title: "Product not found" };

  const pool = comparableOffers(product);
  const low = pool.length > 0 ? Math.min(...pool.map((offer) => offer.price)) : undefined;
  const reference =
    product.kind === "bullion"
      ? "price per gram and premium over the reference rate"
      : "seller prices against launch MRP";

  return {
    title: `${product.name} price comparison`,
    description: low
      ? `Compare ${product.name} across Indian sellers. Best sample price ${inr.format(low)}, with ${reference}.`
      : `Compare ${product.name} across Indian sellers, with ${reference}.`,
    alternates: { canonical: `/p/${product.slug}` },
    robots: { index: isPublicLaunch, follow: isPublicLaunch },
  };
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) notFound();

  const pool = comparableOffers(product);
  const low = lowestOffer(product);
  const prices = pool.map((offer) => offer.price);
  const sorted = [...product.offers].toSorted((left, right) => left.price - right.price);
  const spread = sellerSpread(product);
  const isBullion = product.kind === "bullion";
  const rate = isBullion ? benchmark.rates[product.category] : undefined;
  const history = historyStats(product);

  // AggregateOffer is omitted entirely when no real price exists.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category,
    ...(product.kind === "bullion"
      ? {
          weight: {
            "@type": "QuantitativeValue",
            value: product.weightGrams,
            unitCode: "GRM",
          },
        }
      : {
          brand: { "@type": "Brand", name: product.brand },
          model: product.model,
        }),
    ...(prices.length > 0 && {
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "INR",
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: prices.length,
        offers: pool.map((offer) => ({
          "@type": "Offer",
          priceCurrency: "INR",
          price: offer.price,
          availability: "https://schema.org/InStock",
          url: `${siteUrl}/p/${product.slug}`,
          seller: {
            "@type": "Organization",
            name: getMerchant(offer.merchantId)?.name ?? offer.merchantId,
          },
        })),
      },
    }),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: product.name,
        item: `${siteUrl}/p/${product.slug}`,
      },
    ],
  };

  return (
    <div className="detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([jsonLd, breadcrumbs]).replaceAll("<", "\\u003c"),
        }}
      />

      <Link className="back" href="/">
        <ChevronLeft aria-hidden="true" size={14} />
        All comparisons
      </Link>

      <header className="detail-head">
        <div>
          <p className="detail-kicker">
            {product.kind === "bullion"
              ? `${product.purity} purity · ${formatWeight(product.weightGrams)} · ${product.form}`
              : `${product.brand} · ${product.model} · ${product.variant}`}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-desc">{product.description}</p>
          <ul className="detail-spec">
            {product.kind === "bullion" && rate ? (
              <>
                <li>Reference rate {inr.format(rate)}/g</li>
                <li>Metal value {inr.format(rate * product.weightGrams)}</li>
              </>
            ) : product.kind === "device" ? (
              <>
                <li>Launch MRP {inr.format(product.mrp)}</li>
                <li>{product.variant}</li>
              </>
            ) : null}
            {spread && <li>{inr.format(spread)} between cheapest and dearest</li>}
          </ul>
        </div>

        {low && (
          <aside className="detail-best">
            <span>Lowest offer</span>
            <strong>{inr.format(low.price)}</strong>
            <span>
              {getMerchant(low.merchantId)?.name} · {clock.format(new Date(low.checkedAt))}
            </span>
          </aside>
        )}
      </header>

      {sorted.length === 0 ? (
        <div className="awaiting-panel">
          <strong>No prices yet</strong>
          <p>
            This item is on the tracking list. Offers appear here once an approved seller feed
            is connected, and nothing is shown until a real price exists.
          </p>
        </div>
      ) : (
        <table className="detail-table">
          <caption className="sr-only">
            Sample offers for {product.name} across Indian sellers.
          </caption>
          <thead>
            <tr>
              <th scope="col">Seller</th>
              <th scope="col">Match</th>
              <th scope="col" className="num">Price</th>
              {isBullion && <th scope="col" className="num">Per gram</th>}
              <th scope="col" className="num">Vs reference</th>
              <th scope="col">Checked</th>
              <th scope="col"><span className="sr-only">Visit</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((offer) => {
              const merchant = getMerchant(offer.merchantId);
              const delta = referenceDelta(product, offer);
              const perGram = pricePerGram(product, offer);

              return (
                <tr key={offer.id}>
                  <td>
                    <span className="store">{merchant?.name ?? offer.merchantId}</span>
                    {offer.sellerBrand && <span className="p-meta">{offer.sellerBrand}</span>}
                    {offer.couponNote && <span className="p-meta">{offer.couponNote}</span>}
                  </td>
                  <td>
                    <span className={`match ${offer.matchBasis}`} title={offer.matchNote}>
                      {matchBasisLabels[offer.matchBasis]}
                    </span>
                  </td>
                  <td className="num">
                    <span className="price">{inr.format(offer.price)}</span>
                    {offer.previousPrice && (
                      <span className="was">{inr.format(offer.previousPrice)}</span>
                    )}
                  </td>
                  {isBullion && (
                    <td className="num unit">
                      {perGram === undefined ? "—" : formatPerGram(perGram)}
                    </td>
                  )}
                  <td className="num">
                    {!delta ? (
                      <span className="awaiting">—</span>
                    ) : (
                      <span className="delta-cell">
                        <span className={`premium ${deltaTone(delta.percent)}`}>
                          {delta.percent > 0 ? "+" : ""}
                          {delta.percent.toFixed(1)}%
                        </span>
                        <span className="delta-label">{delta.label}</span>
                      </span>
                    )}
                  </td>
                  <td className="when">{clock.format(new Date(offer.checkedAt))}</td>
                  <td>
                    <a
                      className="visit"
                      href={`/go/${offer.id}?placement=product-page&campaign=preview`}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                    >
                      Visit
                      <ArrowUpRight aria-hidden="true" size={12} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {history && (
        <section className="history" aria-labelledby="history-heading">
          <div className="history-head">
            <div>
              <h2 id="history-heading">90-day price history</h2>
              <p>Lowest price across sellers, sampled daily.</p>
            </div>
            <dl className="history-stats">
              <div>
                <dt>90-day low</dt>
                <dd>{inr.format(history.low)}</dd>
                <span>{history.lowDate ? dayLabel.format(new Date(history.lowDate)) : "—"}</span>
              </div>
              <div>
                <dt>90-day high</dt>
                <dd>{inr.format(history.high)}</dd>
                <span>range {inr.format(history.high - history.low)}</span>
              </div>
              <div>
                <dt>Today</dt>
                <dd>{inr.format(history.current)}</dd>
                <span>
                  {history.isAtLow
                    ? "at the 90-day low"
                    : `${history.aboveLow.toFixed(1)}% above the low`}
                </span>
              </div>
            </dl>
          </div>

          <Sparkline series={history.series} low={history.low} />

          <p className="history-note">
            {history.isAtLow
              ? "This is the lowest price seen in the sampled window, so waiting has historically not helped."
              : `This has been ${inr.format(history.current - history.low)} cheaper within the last 90 days.`}{" "}
            History is generated sample data during preview and is replaced by stored daily
            observations once a feed is connected.
          </p>
        </section>
      )}

      <p className="disclosure">
        Sample data for preview. {productMeta(product)}.{" "}
        {isBullion
          ? "Premium is measured against a demonstration reference rate, and making charges, GST and delivery are set by the seller."
          : "Discount is measured against launch MRP, and warranty, bundled offers and delivery are set by the seller."}{" "}
        Affiliate disclosure: seller links may earn us a commission at no extra cost to you
        once approved tracking is live. Nothing here is investment advice.
      </p>
    </div>
  );
}
