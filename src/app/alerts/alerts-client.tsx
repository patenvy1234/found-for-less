"use client";

import Link from "next/link";
import { BellPlus, ChevronLeft, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  getMerchant,
  lowestOffer,
  products,
  type Product,
} from "@/data/catalog";

const STORAGE_KEY = "ffl.alerts.v1";
const EMPTY = "[]";

type Alert = {
  id: string;
  slug: string;
  targetPrice: number;
  createdAt: string;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const catalog: readonly Product[] = products;
const trackable = catalog.filter((product) => lowestOffer(product) !== undefined);

const listeners = new Set<() => void>();

function readAlerts() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeAlerts(next: Alert[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode can block storage; the UI still reflects the attempt.
  }
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function bestFor(slug: string) {
  const product = catalog.find((item) => item.slug === slug);
  if (!product) return undefined;
  const offer = lowestOffer(product);
  if (!offer) return undefined;
  return { product, offer, merchant: getMerchant(offer.merchantId) };
}

export function AlertsClient() {
  const raw = useSyncExternalStore(subscribe, readAlerts, () => EMPTY);
  const [slug, setSlug] = useState(trackable[0]?.slug ?? "");
  const [target, setTarget] = useState("");

  const alerts = useMemo<Alert[]>(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Alert[]) : [];
    } catch {
      return [];
    }
  }, [raw]);

  const current = bestFor(slug);

  function addAlert(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(target);
    if (!slug || !Number.isFinite(value) || value <= 0) return;

    writeAlerts([
      {
        id: crypto.randomUUID(),
        slug,
        targetPrice: Math.round(value),
        createdAt: new Date().toISOString(),
      },
      ...alerts.filter((alert) => alert.slug !== slug),
    ]);
    setTarget("");
  }

  return (
    <div className="detail alerts">
      <Link className="back" href="/">
        <ChevronLeft aria-hidden="true" size={14} />
        Back to tracker
      </Link>

      <header className="detail-head">
        <div>
          <p className="detail-kicker">Watchlist</p>
          <h1>Price alerts</h1>
          <p className="detail-desc">
            Set the price you would actually pay. Each alert tracks the lowest
            identifier-matched offer for that product across participating retailers.
          </p>
        </div>
      </header>

      <p className="pending">
        <TriangleAlert aria-hidden="true" size={14} />
        <span>
          <strong>Delivery is not live yet.</strong> Alerts are stored in this browser only.
          Email or push notifications need the feed worker, verified consent and a sending
          provider before any message can be sent.
        </span>
      </p>

      <form className="alert-form" onSubmit={addAlert}>
        <label>
          <span>Product</span>
          <select value={slug} onChange={(event) => setSlug(event.target.value)}>
            {trackable.map((product) => (
              <option key={product.slug} value={product.slug}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Target price (₹)</span>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={target}
            placeholder={current ? String(Math.round(current.offer.price * 0.9)) : "0"}
            onChange={(event) => setTarget(event.target.value)}
          />
        </label>

        <button type="submit">
          <BellPlus aria-hidden="true" size={14} />
          Add alert
        </button>
      </form>

      {current && (
        <p className="hint">
          Lowest right now: <strong>{inr.format(current.offer.price)}</strong> at{" "}
          {current.merchant?.name}.
        </p>
      )}

      {alerts.length === 0 ? (
        <div className="empty">
          <strong>No alerts yet.</strong>
          <span>Add a target price above and it will appear here.</span>
        </div>
      ) : (
        <table className="detail-table">
          <caption className="sr-only">Saved price alerts</caption>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className="num">Target</th>
              <th scope="col" className="num">Lowest now</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => {
              const best = bestFor(alert.slug);
              const met = best ? best.offer.price <= alert.targetPrice : false;
              const gap = best ? best.offer.price - alert.targetPrice : 0;

              return (
                <tr key={alert.id}>
                  <td>
                    <Link className="p-name" href={`/p/${alert.slug}`}>
                      {best?.product.name ?? alert.slug}
                    </Link>
                    <span className="p-meta">{best?.merchant?.name ?? "no live offer"}</span>
                  </td>
                  <td className="num">{inr.format(alert.targetPrice)}</td>
                  <td className="num">{best ? inr.format(best.offer.price) : "—"}</td>
                  <td>
                    {!best ? (
                      <span className="match similar">No longer tracked</span>
                    ) : (
                      <span className={met ? "match exact" : "match similar"}>
                        {met ? "Target met" : `₹${gap.toLocaleString("en-IN")} above`}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="watch"
                      aria-label={`Remove alert for ${best?.product.name ?? alert.slug}`}
                      onClick={() =>
                        writeAlerts(alerts.filter((item) => item.id !== alert.id))
                      }
                    >
                      <Trash2 aria-hidden="true" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="disclosure">
        Alerts compare against sample data during preview. Products without at least two
        identifier-matched offers are excluded, because a single listing has nothing to
        compare against.
      </p>
    </div>
  );
}
