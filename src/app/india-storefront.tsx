"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BellPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Info,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  benchmark,
  categories,
  forms,
  getMerchant,
  historyStats,
  isPriced,
  lowestOffer,
  matchBasisLabels,
  pricePerGram,
  productMeta,
  products,
  referenceDelta,
  sellerSpread,
  type CategoryId,
  type Form,
  type Merchant,
  type Offer,
  type Product,
} from "@/data/catalog";

type CategoryFilter = CategoryId | "all";
type FormFilter = Form | "all";
type SortMode = "reference" | "per-gram" | "price";

const PAGE_SIZE = 25;

const categoryOrder = new Map<CategoryId, number>(
  categories.map((item, index) => [item.id, index]),
);

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

type Delta = { percent: number; label: string; reference: string };

type OfferEntry = {
  kind: "offer";
  key: string;
  product: Product;
  offer: Offer;
  merchant: Merchant;
  perGram?: number;
  delta?: Delta;
  isLowest: boolean;
  atNinetyDayLow: boolean;
};

type TrackedEntry = { kind: "tracked"; key: string; product: Product };
type Entry = OfferEntry | TrackedEntry;

const offerEntries: OfferEntry[] = products.flatMap((product) => {
  const lowest = lowestOffer(product);
  const history = historyStats(product);

  return product.offers.flatMap((offer) => {
    const merchant = getMerchant(offer.merchantId);
    if (!merchant) return [];

    const isLowest = offer.id === lowest?.id;

    return [
      {
        kind: "offer" as const,
        key: offer.id,
        product,
        offer,
        merchant,
        perGram: pricePerGram(product, offer),
        delta: referenceDelta(product, offer),
        isLowest,
        atNinetyDayLow: isLowest && Boolean(history?.isAtLow),
      },
    ];
  });
});

const trackedEntries: TrackedEntry[] = products
  .filter((product) => !isPriced(product))
  .map((product) => ({ kind: "tracked" as const, key: product.slug, product }));

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

function DeltaTag({ delta }: { delta?: Delta }) {
  if (!delta) return <span className="awaiting">—</span>;

  return (
    <span className="delta-cell">
      <span className={`premium ${deltaTone(delta.percent)}`}>
        {delta.percent > 0 ? "+" : ""}
        {delta.percent.toFixed(1)}%
      </span>
      <span className="delta-label">{delta.label}</span>
    </span>
  );
}

/** Descending bars: the shortest, highlighted bar is the lowest price. */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#10212c" />
      <rect x="6.8" y="9" width="4.6" height="14" rx="1.8" fill="#7a8996" />
      <rect x="13.7" y="13" width="4.6" height="10" rx="1.8" fill="#b3c0ca" />
      <rect x="20.6" y="16.5" width="4.6" height="6.5" rx="1.8" fill="#22c58c" />
    </svg>
  );
}

export function IndiaStorefront() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [form, setForm] = useState<FormFilter>("all");
  const [merchantId, setMerchantId] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("reference");
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [pricedOnly, setPricedOnly] = useState(true);
  const [showAllSellers, setShowAllSellers] = useState(false);
  const [page, setPage] = useState(0);

  const search = useDeferredValue(query.trim().toLowerCase().replace(/\s+/g, " "));

  const activeCategory = categories.find((item) => item.id === category);
  const bullionScope = category === "all" || activeCategory?.kind === "bullion";

  const matchesProduct = useMemo(
    () => (product: Product, extra = "") => {
      const text = [product.name, productMeta(product), extra].join(" ").toLowerCase();
      const formOk =
        form === "all" || (product.kind === "bullion" && product.form === form);

      return (
        (category === "all" || product.category === category) &&
        formOk &&
        (!savedOnly || savedIds.includes(product.id)) &&
        text.includes(search)
      );
    },
    [category, form, savedIds, savedOnly, search],
  );

  // Seller cards stay outside the seller filter so every seller still compares.
  const scopedOffers = useMemo(
    () =>
      offerEntries.filter((entry) =>
        matchesProduct(entry.product, entry.merchant.name),
      ),
    [matchesProduct],
  );

  const scopedTracked = useMemo(
    () => trackedEntries.filter((entry) => matchesProduct(entry.product)),
    [matchesProduct],
  );

  const visible = useMemo<Entry[]>(() => {
    const offers = scopedOffers
      .filter((entry) => merchantId === "all" || entry.merchant.id === merchantId)
      .toSorted((left, right) => {
        if (sort === "price") return left.offer.price - right.offer.price;
        if (sort === "per-gram") {
          return (left.perGram ?? Infinity) - (right.perGram ?? Infinity);
        }
        // Spot premium and MRP discount are different scales, so never rank across them.
        if (category === "all") {
          const group =
            (categoryOrder.get(left.product.category) ?? 0) -
            (categoryOrder.get(right.product.category) ?? 0);
          if (group !== 0) return group;
        }
        return (left.delta?.percent ?? Infinity) - (right.delta?.percent ?? Infinity);
      });

    // A seller filter cannot apply to products that have no offers yet.
    const showTracked = !pricedOnly && merchantId === "all";
    const trackedSorted = showTracked
      ? scopedTracked.toSorted((left, right) =>
          left.product.name.localeCompare(right.product.name),
        )
      : [];

    return [...offers, ...trackedSorted];
  }, [category, merchantId, pricedOnly, scopedOffers, scopedTracked, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEntries = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const leaders = useMemo(() => {
    const byMerchant = new Map<string, OfferEntry[]>();

    for (const entry of scopedOffers) {
      if (entry.offer.matchBasis === "similar") continue;
      const list = byMerchant.get(entry.merchant.id) ?? [];
      list.push(entry);
      byMerchant.set(entry.merchant.id, list);
    }

    return [...byMerchant.values()]
      .map((list) => {
        const [top] = list.toSorted(
          (left, right) =>
            (left.delta?.percent ?? Infinity) - (right.delta?.percent ?? Infinity),
        );
        return { top, count: list.length };
      })
      .toSorted(
        (left, right) =>
          (left.top.delta?.percent ?? Infinity) - (right.top.delta?.percent ?? Infinity),
      )
      .slice(0, 3);
  }, [scopedOffers]);

  const storeOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const entry of scopedOffers) {
      seen.set(entry.merchant.id, (seen.get(entry.merchant.id) ?? 0) + 1);
    }
    return [...seen.entries()].map(([id, count]) => ({
      merchant: getMerchant(id)!,
      count,
    }));
  }, [scopedOffers]);

  useEffect(() => {
    if (search.length < 2 && category === "all" && merchantId === "all") return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetch("/api/events/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: search || undefined,
          category,
          merchant: merchantId,
          resultCount: visible.length,
        }),
        keepalive: true,
        signal: controller.signal,
      }).catch(() => undefined);
    }, 600);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [category, merchantId, search, visible.length]);

  function toggleSaved(productId: string) {
    setSavedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function chooseCategory(next: CategoryFilter) {
    setCategory(next);
    if (next !== "all" && categories.find((item) => item.id === next)?.kind === "device") {
      setForm("all");
    }
    setPage(0);
  }

  function chooseForm(next: FormFilter) {
    setForm(next);
    setPage(0);
  }

  function chooseMerchant(next: string) {
    setMerchantId(next);
    setPage(0);
  }

  function resetAll() {
    setCategory("all");
    setForm("all");
    setMerchantId("all");
    setQuery("");
    setSavedOnly(false);
    setPage(0);
  }

  const filtersActive =
    category !== "all" ||
    form !== "all" ||
    merchantId !== "all" ||
    savedOnly ||
    query.length > 0;
  const activeLabel = activeCategory?.label ?? "Everything";
  const trackedCount = trackedEntries.length;
  const showPerGram = pageEntries.some(
    (entry) => entry.kind === "offer" && entry.perGram !== undefined,
  );

  return (
    <div className="app">
      <header className="bar">
        <Link className="brand" href="/">
          <BrandMark />
          <span className="brand-text">
            Found for Less
            <em>India price tracker</em>
          </span>
        </Link>

        <label className="bar-search">
          <Search aria-hidden="true" size={15} />
          <span className="sr-only">Search by product, variant or seller</span>
          <input
            type="search"
            value={query}
            placeholder="Search 10g, iPhone, PS5, seller"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPage(0);
              }}
              aria-label="Clear search"
            >
              <X aria-hidden="true" size={14} />
            </button>
          )}
        </label>

        <div className="bar-actions">
          <button
            type="button"
            className={savedOnly ? "btn on" : "btn"}
            aria-pressed={savedOnly}
            onClick={() => {
              setSavedOnly((current) => !current);
              setPage(0);
            }}
          >
            <Heart aria-hidden="true" size={14} fill={savedOnly ? "currentColor" : "none"} />
            <span className="btn-text">
              Saved{savedIds.length > 0 ? ` ${savedIds.length}` : ""}
            </span>
          </button>
          <Link className="btn" href="/alerts">
            <BellPlus aria-hidden="true" size={14} />
            <span className="btn-text">Alerts</span>
          </Link>
          <button type="button" className="btn go" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" size={13} />
            <span className="btn-text">Refresh</span>
          </button>
        </div>
      </header>

      {bullionScope && (
        <section className="rates" aria-label="Reference rate per gram">
          <span className="rates-title">Metal reference rate</span>
          {categories
            .filter((item) => item.kind === "bullion")
            .map((item) => (
              <span key={item.id} className="rate">
                <strong>{inr.format(benchmark.rates[item.id] ?? 0)}</strong>
                <span>{item.label} / g</span>
              </span>
            ))}
          <span className="rates-note">
            Demonstration values · licensed rate feed pending
          </span>
        </section>
      )}

      <nav className="rail" aria-label="Category">
        <button
          type="button"
          className={category === "all" ? "chip on" : "chip"}
          aria-pressed={category === "all"}
          onClick={() => chooseCategory("all")}
        >
          Everything
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className={category === item.id ? "chip on" : "chip"}
            aria-pressed={category === item.id}
            onClick={() => chooseCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
        {bullionScope &&
          forms.map((item) => (
            <button
              key={item.id}
              type="button"
              className={form === item.id ? "chip on" : "chip"}
              aria-pressed={form === item.id}
              onClick={() => chooseForm(form === item.id ? "all" : item.id)}
            >
              {item.label}
            </button>
          ))}
      </nav>

      <div className="body">
        <aside className="side">
          <p className="side-title">Category</p>
          <ul className="side-list">
            <li>
              <button
                type="button"
                className={category === "all" ? "side-item on" : "side-item"}
                aria-pressed={category === "all"}
                onClick={() => chooseCategory("all")}
              >
                Everything
                <span>{products.length}</span>
              </button>
            </li>
            {categories.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={category === item.id ? "side-item on" : "side-item"}
                  aria-pressed={category === item.id}
                  onClick={() => chooseCategory(item.id)}
                >
                  {item.label}
                  <span>
                    {products.filter((product) => product.category === item.id).length}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {bullionScope && (
            <div className="form-toggle" role="group" aria-label="Metal form">
              <button
                type="button"
                className={form === "all" ? "on" : ""}
                aria-pressed={form === "all"}
                onClick={() => chooseForm("all")}
              >
                All
              </button>
              {forms.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={form === item.id ? "on" : ""}
                  aria-pressed={form === item.id}
                  onClick={() => chooseForm(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <p className="side-title">Seller</p>
          <ul className="side-list">
            <li>
              <button
                type="button"
                className={merchantId === "all" ? "side-item on" : "side-item"}
                aria-pressed={merchantId === "all"}
                onClick={() => chooseMerchant("all")}
              >
                All sellers
                <span>{scopedOffers.length}</span>
              </button>
            </li>
            {(showAllSellers ? storeOptions : storeOptions.slice(0, 5)).map(
              ({ merchant, count }) => (
                <li key={merchant.id}>
                  <button
                    type="button"
                    className={merchantId === merchant.id ? "side-item on" : "side-item"}
                    aria-pressed={merchantId === merchant.id}
                    onClick={() => chooseMerchant(merchant.id)}
                  >
                    {merchant.name}
                    <span>{count}</span>
                  </button>
                </li>
              ),
            )}
            {storeOptions.length > 5 && (
              <li>
                <button
                  type="button"
                  className="side-more"
                  onClick={() => setShowAllSellers((current) => !current)}
                >
                  {showAllSellers
                    ? "Show fewer"
                    : `Show all ${storeOptions.length} sellers`}
                </button>
              </li>
            )}
          </ul>
        </aside>

        <main className="main">
          <p className="notice">
            Independent preview. Prices are sample data and {trackedCount} tracked items have
            no price yet. Confirm the live price, seller, warranty and delivery on the
            seller&apos;s page before buying.
          </p>

          {leaders.length > 0 && (
            <section className="leaders" aria-label="Best offer by seller">
              {leaders.map(({ top, count }) => {
                const spread = sellerSpread(top.product);
                return (
                  <article key={top.merchant.id} className="leader">
                    <div className="leader-head">
                      <span className="store">{top.merchant.name}</span>
                      <span>best {top.delta?.label ?? "offer"}</span>
                    </div>
                    <p className="leader-price">
                      <DeltaTag delta={top.delta} />
                      <em>{inr.format(top.offer.price)}</em>
                    </p>
                    <p className="leader-name">{top.product.name}</p>
                    <div className="leader-foot">
                      <span>
                        {spread ? `${inr.format(spread)} spread` : "single seller"}
                      </span>
                      <span>{count} priced</span>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          <section className="controls" aria-label="Sort and filter">
            <p className="count">
              <strong>{visible.length}</strong> rows · {activeLabel}
            </p>
            <div className="control-tools">
              {filtersActive && (
                <button type="button" className="reset" onClick={resetAll}>
                  Clear filters
                </button>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={!pricedOnly}
                  onChange={(event) => {
                    setPricedOnly(!event.target.checked);
                    setPage(0);
                  }}
                />
                Include items without prices
              </label>
              <label className="select">
                <span className="sr-only">Sort offers</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                >
                  <option value="reference">Best value</option>
                  <option value="price">Lowest price</option>
                  <option value="per-gram">Price per gram</option>
                </select>
              </label>
            </div>
          </section>

          <p className="explainer">
            <strong>Best value</strong> compares each price to its own benchmark — the spot
            rate per gram for metals, launch MRP for phones and consoles. Lower is better.
          </p>

          {pageEntries.length === 0 ? (
            <div className="empty">
              <strong>Nothing matches those filters.</strong>
              <button type="button" onClick={resetAll}>
                Show everything
              </button>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="offers">
                  <caption className="sr-only">
                    Offers by seller, measured against the spot rate for metals and launch
                    MRP for devices.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="c-store">Seller</th>
                      <th scope="col" className="num c-price">Price</th>
                      {showPerGram && (
                        <th scope="col" className="num c-unit">Per gram</th>
                      )}
                      <th scope="col" className="num c-off">Vs reference</th>
                      <th scope="col" className="c-match">Match</th>
                      <th scope="col" className="c-when">Checked</th>
                      <th scope="col" className="c-act">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.map((entry) => {
                      const saved = savedIds.includes(entry.product.id);

                      if (entry.kind === "tracked") {
                        return (
                          <tr key={entry.key} className="tracked-row">
                            <td>
                              <Link className="p-name" href={`/p/${entry.product.slug}`}>
                                {entry.product.name}
                              </Link>
                              <span className="p-meta">{productMeta(entry.product)}</span>
                            </td>
                            <td className="awaiting">—</td>
                            <td className="num awaiting">Awaiting feed</td>
                            {showPerGram && <td className="num awaiting">—</td>}
                            <td className="num awaiting">—</td>
                            <td>
                              <span className="match tracking">Tracking</span>
                            </td>
                            <td className="awaiting">—</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className={saved ? "watch on" : "watch"}
                                  aria-pressed={saved}
                                  aria-label={`${saved ? "Remove" : "Save"} ${entry.product.name}`}
                                  onClick={() => toggleSaved(entry.product.id)}
                                >
                                  <Heart
                                    aria-hidden="true"
                                    size={13}
                                    fill={saved ? "currentColor" : "none"}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={entry.key}>
                          <td>
                            <Link className="p-name" href={`/p/${entry.product.slug}`}>
                              {entry.product.name}
                            </Link>
                            <span className="p-meta">{productMeta(entry.product)}</span>
                          </td>
                          <td>
                            <span className="store">{entry.merchant.name}</span>
                            {entry.offer.sellerBrand && (
                              <span className="p-meta">{entry.offer.sellerBrand}</span>
                            )}
                          </td>
                          <td className="num">
                            <span className="price">
                              {inr.format(entry.offer.price)}
                              {entry.atNinetyDayLow ? (
                                <span className="flag low90">90d low</span>
                              ) : (
                                entry.isLowest && (
                                  <span className="flag">
                                    <Check aria-hidden="true" size={10} /> low
                                  </span>
                                )
                              )}
                            </span>
                            {entry.offer.previousPrice && (
                              <span className="was">
                                {inr.format(entry.offer.previousPrice)}
                              </span>
                            )}
                          </td>
                          {showPerGram && (
                            <td className="num unit">
                              {entry.perGram === undefined
                                ? "—"
                                : formatPerGram(entry.perGram)}
                            </td>
                          )}
                          <td className="num">
                            <DeltaTag delta={entry.delta} />
                          </td>
                          <td>
                            <span
                              className={`match ${entry.offer.matchBasis}`}
                              title={entry.offer.matchNote}
                            >
                              {matchBasisLabels[entry.offer.matchBasis]}
                            </span>
                          </td>
                          <td className="when">
                            {clock.format(new Date(entry.offer.checkedAt))}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className={saved ? "watch on" : "watch"}
                                aria-pressed={saved}
                                aria-label={`${saved ? "Remove" : "Save"} ${entry.product.name}`}
                                onClick={() => toggleSaved(entry.product.id)}
                              >
                                <Heart
                                  aria-hidden="true"
                                  size={13}
                                  fill={saved ? "currentColor" : "none"}
                                />
                              </button>
                              <a
                                className="visit"
                                href={`/go/${entry.offer.id}?placement=price-table&campaign=preview`}
                                target="_blank"
                                rel="sponsored noopener noreferrer"
                              >
                                Visit
                                <ArrowUpRight aria-hidden="true" size={12} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="offer-list">
                {pageEntries.map((entry) => {
                  const saved = savedIds.includes(entry.product.id);

                  if (entry.kind === "tracked") {
                    return (
                      <li key={entry.key} className="tracked-row">
                        <div className="card-top">
                          <div>
                            <Link className="p-name" href={`/p/${entry.product.slug}`}>
                              {entry.product.name}
                            </Link>
                            <span className="p-meta">{productMeta(entry.product)}</span>
                          </div>
                          <button
                            type="button"
                            className={saved ? "watch on" : "watch"}
                            aria-pressed={saved}
                            aria-label={`${saved ? "Remove" : "Save"} ${entry.product.name}`}
                            onClick={() => toggleSaved(entry.product.id)}
                          >
                            <Heart
                              aria-hidden="true"
                              size={14}
                              fill={saved ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                        <div className="card-foot">
                          <span className="match tracking">Tracking</span>
                          <span className="awaiting">Awaiting feed</span>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={entry.key}>
                      <div className="card-top">
                        <div>
                          <Link className="p-name" href={`/p/${entry.product.slug}`}>
                            {entry.product.name}
                          </Link>
                          <span className="p-meta">{productMeta(entry.product)}</span>
                        </div>
                        <button
                          type="button"
                          className={saved ? "watch on" : "watch"}
                          aria-pressed={saved}
                          aria-label={`${saved ? "Remove" : "Save"} ${entry.product.name}`}
                          onClick={() => toggleSaved(entry.product.id)}
                        >
                          <Heart
                            aria-hidden="true"
                            size={14}
                            fill={saved ? "currentColor" : "none"}
                          />
                        </button>
                      </div>

                      <div className="card-price">
                        <span className="price">{inr.format(entry.offer.price)}</span>
                        {entry.perGram !== undefined && (
                          <span className="unit">{formatPerGram(entry.perGram)}/g</span>
                        )}
                        <DeltaTag delta={entry.delta} />
                        {entry.atNinetyDayLow ? (
                          <span className="flag low90">90d low</span>
                        ) : (
                          entry.isLowest && (
                            <span className="flag">
                              <Check aria-hidden="true" size={10} /> low
                            </span>
                          )
                        )}
                      </div>

                      <div className="card-foot">
                        <span className="store">{entry.merchant.name}</span>
                        {entry.offer.sellerBrand && (
                          <span className="when">{entry.offer.sellerBrand}</span>
                        )}
                        <span className="when">
                          {clock.format(new Date(entry.offer.checkedAt))}
                        </span>
                        <a
                          className="visit"
                          href={`/go/${entry.offer.id}?placement=price-list&campaign=preview`}
                          target="_blank"
                          rel="sponsored noopener noreferrer"
                        >
                          Visit
                          <ArrowUpRight aria-hidden="true" size={12} />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {pageCount > 1 && (
                <nav className="pager" aria-label="Pagination">
                  <button
                    type="button"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronLeft aria-hidden="true" size={14} />
                    Previous
                  </button>
                  <span>
                    Page {safePage + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Next
                    <ChevronRight aria-hidden="true" size={14} />
                  </button>
                </nav>
              )}
            </>
          )}

          <p className="legend">
            <Info aria-hidden="true" size={13} />
            <span>
              <strong>Vs reference</strong> compares each offer to a fixed benchmark, and lower
              is always better. Metals use the spot rate per gram, so a positive number is the
              premium you pay over the metal value. Phones and consoles use launch MRP, so a
              negative number is the discount. Making charges, GST, warranty and delivery are
              set by the seller and are not included.
            </span>
          </p>

          <p className="disclosure">
            Affiliate disclosure: seller links may earn us a commission at no extra cost to you
            once approved tracking is live. Nothing here is investment advice.
          </p>
        </main>
      </div>

      <footer className="foot">
        <span>Found for Less · provisional name · independent preview</span>
        <nav aria-label="Policies">
          <Link href="/alerts">Alerts</Link>
          <a href="#legend">Method</a>
          <a href="#legend">Disclosure</a>
          <a href="#legend">Report an error</a>
        </nav>
      </footer>
    </div>
  );
}
