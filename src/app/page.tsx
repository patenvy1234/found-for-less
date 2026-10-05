import type { Metadata } from "next";
import { IndiaStorefront } from "./india-storefront";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return <IndiaStorefront />;
}
