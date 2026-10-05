import type { Metadata } from "next";
import { AlertsClient } from "./alerts-client";

const isPublicLaunch = process.env.NEXT_PUBLIC_SITE_MODE === "production";

export const metadata: Metadata = {
  title: "Price alerts",
  description:
    "Set a target price for tracked products and see which Indian retailer is closest to it.",
  alternates: { canonical: "/alerts" },
  robots: { index: isPublicLaunch, follow: isPublicLaunch },
};

export default function AlertsPage() {
  return <AlertsClient />;
}
