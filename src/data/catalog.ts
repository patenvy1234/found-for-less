export type CategoryId =
  | "gold-999"
  | "gold-916"
  | "silver-999"
  | "phones"
  | "consoles";

export type Form = "coin" | "bar";

/** How confidently an offer maps to the canonical product. */
export type MatchBasis = "exact" | "equivalent" | "similar";

export type Merchant = {
  id: string;
  name: string;
  domains: readonly string[];
};

export type Offer = {
  id: string;
  merchantId: string;
  price: number;
  previousPrice?: number;
  matchBasis: MatchBasis;
  matchNote: string;
  /** Jeweller or mint behind the listing; affects buyback, not purity. */
  sellerBrand?: string;
  /** Why a marketplace price can sit below a mint price. */
  couponNote?: string;
  destinationUrl: string;
  checkedAt: string;
};

type BaseProduct = {
  id: string;
  slug: string;
  name: string;
  category: CategoryId;
  description: string;
  offers: readonly Offer[];
};

export type BullionProduct = BaseProduct & {
  kind: "bullion";
  form: Form;
  weightGrams: number;
  purity: string;
};

export type DeviceProduct = BaseProduct & {
  kind: "device";
  brand: string;
  model: string;
  variant: string;
  mrp: number;
};

export type Product = BullionProduct | DeviceProduct;

export const categories = [
  { id: "gold-999", label: "24K gold (999)", kind: "bullion" },
  { id: "gold-916", label: "22K gold (916)", kind: "bullion" },
  { id: "silver-999", label: "Silver (999)", kind: "bullion" },
  { id: "phones", label: "Flagship phones", kind: "device" },
  { id: "consoles", label: "Consoles", kind: "device" },
] as const satisfies readonly {
  id: CategoryId;
  label: string;
  kind: Product["kind"];
}[];

export const forms = [
  { id: "coin", label: "Coins" },
  { id: "bar", label: "Bars" },
] as const satisfies readonly { id: Form; label: string }[];

export const merchants = [
  { id: "mmtcpamp", name: "MMTC-PAMP", domains: ["mmtcpamp.com"] },
  { id: "augmont", name: "Augmont", domains: ["augmont.com"] },
  { id: "candere", name: "Candere", domains: ["candere.com"] },
  { id: "flipkart", name: "Flipkart", domains: ["flipkart.com"] },
  { id: "myntra", name: "Myntra", domains: ["myntra.com"] },
  { id: "ajio", name: "Ajio", domains: ["ajio.com"] },
  { id: "amazon", name: "Amazon.in", domains: ["amazon.in"] },
  { id: "tatacliq", name: "Tata CLiQ", domains: ["tatacliq.com"] },
  { id: "croma", name: "Croma", domains: ["croma.com"] },
  { id: "reliancedigital", name: "Reliance Digital", domains: ["reliancedigital.in"] },
] as const satisfies readonly Merchant[];

export const matchBasisLabels: Record<MatchBasis, string> = {
  exact: "Exact",
  equivalent: "Equivalent",
  similar: "Similar",
};

/**
 * Reference rate per gram. Demonstration values until a licensed rate feed is
 * connected; every bullion premium on the site is derived from these numbers.
 */
export const benchmark = {
  updatedAt: "2026-08-27T09:15:00.000Z",
  source: "pending",
  rates: {
    "gold-999": 16298,
    "gold-916": 14940,
    "silver-999": 205,
  } as Partial<Record<CategoryId, number>>,
};

function displayWeight(grams: number) {
  if (grams >= 1000) return `${grams / 1000} kg`;
  return `${grams} g`;
}

function bullionName(category: CategoryId, form: Form, grams: number) {
  const metal =
    category === "silver-999"
      ? "999 silver"
      : category === "gold-916"
        ? "22K 916 gold"
        : "24K 999 gold";
  return `${metal} ${form}, ${displayWeight(grams)}`;
}

function buildBullion(category: CategoryId, form: Form, grams: number): BullionProduct {
  const purity = category === "silver-999" ? "999" : category === "gold-916" ? "916" : "999";
  const metalSlug = category === "silver-999" ? "silver-999" : `gold-${purity}`;
  const weightSlug = grams >= 1000 ? `${grams / 1000}kg` : `${grams}g`;

  return {
    kind: "bullion",
    id: `sku-${metalSlug}-${form}-${weightSlug}`,
    slug: `${metalSlug}-${form}-${weightSlug}`,
    name: bullionName(category, form, grams),
    category,
    form,
    weightGrams: grams,
    purity,
    description: `${purity} purity ${form} weighing ${displayWeight(
      grams,
    )}. Purity and weight are standardised, so offers are compared per gram and against the reference rate.`,
    offers: [],
  };
}

function buildDevice(
  category: CategoryId,
  brand: string,
  model: string,
  variant: string,
  mrp: number,
  slug: string,
): DeviceProduct {
  return {
    kind: "device",
    id: `sku-${slug}`,
    slug,
    name: `${brand} ${model} (${variant})`,
    category,
    brand,
    model,
    variant,
    mrp,
    description: `${brand} ${model}, ${variant}. The same manufacturer model and variant at every seller, so street prices are directly comparable and measured against the launch MRP.`,
    offers: [],
  };
}

const skuGrid: readonly Product[] = [
  ...[0.5, 1, 2, 3, 4, 5, 8, 10, 20, 50].map((g) => buildBullion("gold-999", "coin", g)),
  ...[5, 10, 20, 50, 100].map((g) => buildBullion("gold-999", "bar", g)),
  ...[1, 5, 8, 10].map((g) => buildBullion("gold-916", "coin", g)),
  ...[5, 10, 20, 50, 100].map((g) => buildBullion("silver-999", "coin", g)),
  ...[100, 250, 500, 1000].map((g) => buildBullion("silver-999", "bar", g)),

  buildDevice("phones", "Apple", "iPhone 15", "128 GB", 79900, "iphone-15-128gb"),
  buildDevice("phones", "Apple", "iPhone 15", "256 GB", 89900, "iphone-15-256gb"),
  buildDevice("phones", "Apple", "iPhone 15 Pro", "128 GB", 134900, "iphone-15-pro-128gb"),
  buildDevice("phones", "Apple", "iPhone 15 Pro", "256 GB", 144900, "iphone-15-pro-256gb"),
  buildDevice("phones", "Samsung", "Galaxy S24", "128 GB", 79999, "galaxy-s24-128gb"),
  buildDevice("phones", "Samsung", "Galaxy S24", "256 GB", 85999, "galaxy-s24-256gb"),
  buildDevice("phones", "Samsung", "Galaxy S24 Ultra", "256 GB", 129999, "galaxy-s24-ultra-256gb"),
  buildDevice("phones", "Samsung", "Galaxy S24 Ultra", "512 GB", 139999, "galaxy-s24-ultra-512gb"),

  buildDevice("consoles", "Sony", "PlayStation 5 Slim", "Disc edition", 54990, "ps5-slim-disc"),
  buildDevice("consoles", "Sony", "PlayStation 5 Slim", "Digital edition", 44990, "ps5-slim-digital"),
  buildDevice("consoles", "Sony", "PlayStation 5 Pro", "2 TB", 79990, "ps5-pro-2tb"),
  buildDevice("consoles", "Microsoft", "Xbox Series X", "1 TB", 52990, "xbox-series-x-1tb"),
  buildDevice("consoles", "Microsoft", "Xbox Series S", "512 GB", 34990, "xbox-series-s-512gb"),
];

/** Sample offers, keyed by product slug. Replaced wholesale by the first feed run. */
const sampleOffers: Record<string, readonly Offer[]> = {
  "gold-999-coin-1g": [
    {
      id: "offer-g999-c1-mmtcpamp",
      merchantId: "mmtcpamp",
      price: 17299,
      previousPrice: 18199,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.mmtcpamp.com/gold-coins",
      checkedAt: "2026-08-27T09:10:00.000Z",
    },
    {
      id: "offer-g999-c1-augmont",
      merchantId: "augmont",
      price: 17420,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.augmont.com/gold-coins",
      checkedAt: "2026-08-27T09:08:00.000Z",
    },
    {
      id: "offer-g999-c1-flipkart",
      merchantId: "flipkart",
      price: 17640,
      previousPrice: 18499,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "P. N. Gadgil Jewellers",
      destinationUrl: "https://www.flipkart.com/search?q=24k%20999%201g%20gold%20coin",
      checkedAt: "2026-08-27T09:06:00.000Z",
    },
    {
      id: "offer-g999-c1-ajio",
      merchantId: "ajio",
      price: 17050,
      previousPrice: 18200,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Muthoot PAPPACHAN",
      couponNote: "Net of listed coupon",
      destinationUrl: "https://www.ajio.com/search/?text=24k%20999%20gold%20coin",
      checkedAt: "2026-08-27T09:09:00.000Z",
    },
    {
      id: "offer-g999-c1-myntra",
      merchantId: "myntra",
      price: 17380,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Kalyan Jewellers",
      couponNote: "No coupon listed",
      destinationUrl: "https://www.myntra.com/gold-coin",
      checkedAt: "2026-08-27T09:07:00.000Z",
    },
  ],
  "gold-999-coin-2g": [
    {
      id: "offer-g999-c2-ajio",
      merchantId: "ajio",
      price: 33690,
      previousPrice: 35900,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Muthoot PAPPACHAN",
      couponNote: "Net of listed coupon",
      destinationUrl: "https://www.ajio.com/search/?text=2g%20gold%20coin",
      checkedAt: "2026-08-27T09:04:00.000Z",
    },
    {
      id: "offer-g999-c2-myntra",
      merchantId: "myntra",
      price: 33940,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Kalyan Jewellers",
      destinationUrl: "https://www.myntra.com/gold-coin",
      checkedAt: "2026-08-27T09:02:00.000Z",
    },
    {
      id: "offer-g999-c2-flipkart",
      merchantId: "flipkart",
      price: 34120,
      previousPrice: 35600,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "P. N. Gadgil Jewellers",
      destinationUrl: "https://www.flipkart.com/search?q=2g%20gold%20coin%2024k",
      checkedAt: "2026-08-27T09:00:00.000Z",
    },
    {
      id: "offer-g999-c2-mmtcpamp",
      merchantId: "mmtcpamp",
      price: 34450,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "MMTC-PAMP",
      destinationUrl: "https://www.mmtcpamp.com/gold-coins",
      checkedAt: "2026-08-27T08:57:00.000Z",
    },
  ],
  "gold-999-coin-3g": [
    {
      id: "offer-g999-c3-ajio",
      merchantId: "ajio",
      price: 50240,
      previousPrice: 53400,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Muthoot PAPPACHAN",
      couponNote: "Net of listed coupon",
      destinationUrl: "https://www.ajio.com/search/?text=3g%20gold%20coin",
      checkedAt: "2026-08-27T09:12:00.000Z",
    },
    {
      id: "offer-g999-c3-flipkart",
      merchantId: "flipkart",
      price: 50890,
      previousPrice: 53900,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "P. N. Gadgil Jewellers",
      couponNote: "Net of listed coupon and gift card",
      destinationUrl: "https://www.flipkart.com/search?q=3g%20gold%20coin%2024k",
      checkedAt: "2026-08-27T09:11:00.000Z",
    },
    {
      id: "offer-g999-c3-myntra",
      merchantId: "myntra",
      price: 51320,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Kalyan Jewellers",
      destinationUrl: "https://www.myntra.com/gold-coin",
      checkedAt: "2026-08-27T09:08:00.000Z",
    },
  ],
  "gold-999-coin-5g": [
    {
      id: "offer-g999-c5-mmtcpamp",
      merchantId: "mmtcpamp",
      price: 84900,
      previousPrice: 88500,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.mmtcpamp.com/gold-coins",
      checkedAt: "2026-08-27T09:05:00.000Z",
    },
    {
      id: "offer-g999-c5-augmont",
      merchantId: "augmont",
      price: 85400,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.augmont.com/gold-coins",
      checkedAt: "2026-08-27T09:03:00.000Z",
    },
    {
      id: "offer-g999-c5-tatacliq",
      merchantId: "tatacliq",
      price: 86750,
      previousPrice: 89900,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.tatacliq.com/search/?text=5g%20gold%20coin%2024k",
      checkedAt: "2026-08-27T09:01:00.000Z",
    },
  ],
  "gold-999-bar-10g": [
    {
      id: "offer-g999-b10-mmtcpamp",
      merchantId: "mmtcpamp",
      price: 167500,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.mmtcpamp.com/gold-bars",
      checkedAt: "2026-08-27T08:58:00.000Z",
    },
    {
      id: "offer-g999-b10-augmont",
      merchantId: "augmont",
      price: 168200,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.augmont.com/gold-bars",
      checkedAt: "2026-08-27T08:56:00.000Z",
    },
    {
      id: "offer-g999-b10-amazon",
      merchantId: "amazon",
      price: 170400,
      previousPrice: 173900,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.amazon.in/s?k=10g+24k+gold+bar",
      checkedAt: "2026-08-27T08:54:00.000Z",
    },
  ],
  "gold-916-coin-10g": [
    {
      id: "offer-g916-c10-candere",
      merchantId: "candere",
      price: 154300,
      previousPrice: 158900,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, making charge varies",
      destinationUrl: "https://www.candere.com/gold-coins",
      checkedAt: "2026-08-27T08:50:00.000Z",
    },
    {
      id: "offer-g916-c10-tatacliq",
      merchantId: "tatacliq",
      price: 156800,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, making charge varies",
      destinationUrl: "https://www.tatacliq.com/search/?text=22k%20gold%20coin%2010g",
      checkedAt: "2026-08-27T08:47:00.000Z",
    },
  ],
  "silver-999-coin-10g": [
    {
      id: "offer-s999-c10-augmont",
      merchantId: "augmont",
      price: 2150,
      previousPrice: 2400,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.augmont.com/silver-coins",
      checkedAt: "2026-08-27T09:02:00.000Z",
    },
    {
      id: "offer-s999-c10-flipkart",
      merchantId: "flipkart",
      price: 2199,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.flipkart.com/search?q=999%20silver%20coin%2010g",
      checkedAt: "2026-08-27T08:59:00.000Z",
    },
    {
      id: "offer-s999-c10-amazon",
      merchantId: "amazon",
      price: 2240,
      previousPrice: 2450,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.amazon.in/s?k=999+silver+coin+10g",
      checkedAt: "2026-08-27T08:57:00.000Z",
    },
    {
      id: "offer-s999-c10-ajio",
      merchantId: "ajio",
      price: 2175,
      previousPrice: 2390,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Muthoot PAPPACHAN",
      couponNote: "Net of listed coupon",
      destinationUrl: "https://www.ajio.com/search/?text=999%20silver%20coin",
      checkedAt: "2026-08-27T08:55:00.000Z",
    },
    {
      id: "offer-s999-c10-myntra",
      merchantId: "myntra",
      price: 2215,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Kalyan Jewellers",
      destinationUrl: "https://www.myntra.com/silver-coin",
      checkedAt: "2026-08-27T08:53:00.000Z",
    },
  ],
  "silver-999-coin-50g": [
    {
      id: "offer-s999-c50-augmont",
      merchantId: "augmont",
      price: 10650,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.augmont.com/silver-coins",
      checkedAt: "2026-08-27T08:52:00.000Z",
    },
    {
      id: "offer-s999-c50-mmtcpamp",
      merchantId: "mmtcpamp",
      price: 10820,
      previousPrice: 11400,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.mmtcpamp.com/silver-coins",
      checkedAt: "2026-08-27T08:49:00.000Z",
    },
    {
      id: "offer-s999-c50-ajio",
      merchantId: "ajio",
      price: 10720,
      previousPrice: 11600,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Muthoot PAPPACHAN",
      couponNote: "Net of listed coupon",
      destinationUrl: "https://www.ajio.com/search/?text=50g%20silver%20coin",
      checkedAt: "2026-08-27T08:47:00.000Z",
    },
    {
      id: "offer-s999-c50-myntra",
      merchantId: "myntra",
      price: 10890,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      sellerBrand: "Kalyan Jewellers",
      destinationUrl: "https://www.myntra.com/silver-coin",
      checkedAt: "2026-08-27T08:44:00.000Z",
    },
  ],
  "silver-999-bar-100g": [
    {
      id: "offer-s999-b100-mmtcpamp",
      merchantId: "mmtcpamp",
      price: 20999,
      previousPrice: 22400,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.mmtcpamp.com/silver-bars",
      checkedAt: "2026-08-27T08:45:00.000Z",
    },
    {
      id: "offer-s999-b100-augmont",
      merchantId: "augmont",
      price: 21150,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.augmont.com/silver-bars",
      checkedAt: "2026-08-27T08:43:00.000Z",
    },
    {
      id: "offer-s999-b100-flipkart",
      merchantId: "flipkart",
      price: 21690,
      previousPrice: 22900,
      matchBasis: "equivalent",
      matchNote: "Same purity and weight, different mint",
      destinationUrl: "https://www.flipkart.com/search?q=999%20silver%20bar%20100g",
      checkedAt: "2026-08-27T08:41:00.000Z",
    },
  ],

  "iphone-15-128gb": [
    {
      id: "offer-ip15-128-flipkart",
      merchantId: "flipkart",
      price: 62999,
      previousPrice: 79900,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.flipkart.com/search?q=apple%20iphone%2015%20128gb",
      checkedAt: "2026-08-27T09:12:00.000Z",
    },
    {
      id: "offer-ip15-128-amazon",
      merchantId: "amazon",
      price: 63499,
      previousPrice: 79900,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.amazon.in/s?k=apple+iphone+15+128gb",
      checkedAt: "2026-08-27T09:11:00.000Z",
    },
    {
      id: "offer-ip15-128-croma",
      merchantId: "croma",
      price: 65900,
      previousPrice: 79900,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.croma.com/search?q=apple%20iphone%2015%20128gb",
      checkedAt: "2026-08-27T09:09:00.000Z",
    },
  ],
  "iphone-15-pro-128gb": [
    {
      id: "offer-ip15p-128-amazon",
      merchantId: "amazon",
      price: 109900,
      previousPrice: 134900,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.amazon.in/s?k=apple+iphone+15+pro+128gb",
      checkedAt: "2026-08-27T09:07:00.000Z",
    },
    {
      id: "offer-ip15p-128-flipkart",
      merchantId: "flipkart",
      price: 111499,
      previousPrice: 134900,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.flipkart.com/search?q=apple%20iphone%2015%20pro%20128gb",
      checkedAt: "2026-08-27T09:05:00.000Z",
    },
    {
      id: "offer-ip15p-128-reliancedigital",
      merchantId: "reliancedigital",
      price: 114900,
      previousPrice: 134900,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.reliancedigital.in/search?q=iphone%2015%20pro",
      checkedAt: "2026-08-27T09:02:00.000Z",
    },
  ],
  "galaxy-s24-128gb": [
    {
      id: "offer-s24-128-amazon",
      merchantId: "amazon",
      price: 57999,
      previousPrice: 79999,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.amazon.in/s?k=samsung+galaxy+s24+128gb",
      checkedAt: "2026-08-27T09:04:00.000Z",
    },
    {
      id: "offer-s24-128-flipkart",
      merchantId: "flipkart",
      price: 58999,
      previousPrice: 79999,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.flipkart.com/search?q=samsung%20galaxy%20s24%20128gb",
      checkedAt: "2026-08-27T09:03:00.000Z",
    },
    {
      id: "offer-s24-128-croma",
      merchantId: "croma",
      price: 61490,
      previousPrice: 79999,
      matchBasis: "exact",
      matchNote: "Same model and 128 GB variant",
      destinationUrl: "https://www.croma.com/search?q=samsung%20galaxy%20s24",
      checkedAt: "2026-08-27T09:00:00.000Z",
    },
  ],
  "galaxy-s24-ultra-256gb": [
    {
      id: "offer-s24u-256-flipkart",
      merchantId: "flipkart",
      price: 104999,
      previousPrice: 129999,
      matchBasis: "exact",
      matchNote: "Same model and 256 GB variant",
      destinationUrl: "https://www.flipkart.com/search?q=samsung%20galaxy%20s24%20ultra%20256gb",
      checkedAt: "2026-08-27T08:59:00.000Z",
    },
    {
      id: "offer-s24u-256-amazon",
      merchantId: "amazon",
      price: 106990,
      previousPrice: 129999,
      matchBasis: "exact",
      matchNote: "Same model and 256 GB variant",
      destinationUrl: "https://www.amazon.in/s?k=samsung+galaxy+s24+ultra+256gb",
      checkedAt: "2026-08-27T08:57:00.000Z",
    },
    {
      id: "offer-s24u-256-reliancedigital",
      merchantId: "reliancedigital",
      price: 109999,
      previousPrice: 129999,
      matchBasis: "exact",
      matchNote: "Same model and 256 GB variant",
      destinationUrl: "https://www.reliancedigital.in/search?q=galaxy%20s24%20ultra",
      checkedAt: "2026-08-27T08:55:00.000Z",
    },
  ],
  "ps5-slim-disc": [
    {
      id: "offer-ps5-disc-amazon",
      merchantId: "amazon",
      price: 49990,
      previousPrice: 54990,
      matchBasis: "exact",
      matchNote: "Same console and disc edition",
      destinationUrl: "https://www.amazon.in/s?k=playstation+5+slim+disc",
      checkedAt: "2026-08-27T09:14:00.000Z",
    },
    {
      id: "offer-ps5-disc-flipkart",
      merchantId: "flipkart",
      price: 50990,
      previousPrice: 54990,
      matchBasis: "exact",
      matchNote: "Same console and disc edition",
      destinationUrl: "https://www.flipkart.com/search?q=playstation%205%20slim%20disc",
      checkedAt: "2026-08-27T09:13:00.000Z",
    },
    {
      id: "offer-ps5-disc-croma",
      merchantId: "croma",
      price: 52990,
      previousPrice: 54990,
      matchBasis: "exact",
      matchNote: "Same console and disc edition",
      destinationUrl: "https://www.croma.com/search?q=playstation%205",
      checkedAt: "2026-08-27T09:10:00.000Z",
    },
  ],
  "ps5-slim-digital": [
    {
      id: "offer-ps5-digital-flipkart",
      merchantId: "flipkart",
      price: 39990,
      previousPrice: 44990,
      matchBasis: "exact",
      matchNote: "Same console and digital edition",
      destinationUrl: "https://www.flipkart.com/search?q=playstation%205%20digital%20edition",
      checkedAt: "2026-08-27T09:08:00.000Z",
    },
    {
      id: "offer-ps5-digital-amazon",
      merchantId: "amazon",
      price: 40990,
      previousPrice: 44990,
      matchBasis: "exact",
      matchNote: "Same console and digital edition",
      destinationUrl: "https://www.amazon.in/s?k=playstation+5+digital+edition",
      checkedAt: "2026-08-27T09:06:00.000Z",
    },
  ],
  "xbox-series-x-1tb": [
    {
      id: "offer-xsx-amazon",
      merchantId: "amazon",
      price: 46990,
      previousPrice: 52990,
      matchBasis: "exact",
      matchNote: "Same console and 1 TB variant",
      destinationUrl: "https://www.amazon.in/s?k=xbox+series+x",
      checkedAt: "2026-08-27T09:01:00.000Z",
    },
    {
      id: "offer-xsx-flipkart",
      merchantId: "flipkart",
      price: 47990,
      previousPrice: 52990,
      matchBasis: "exact",
      matchNote: "Same console and 1 TB variant",
      destinationUrl: "https://www.flipkart.com/search?q=xbox%20series%20x",
      checkedAt: "2026-08-27T08:58:00.000Z",
    },
    {
      id: "offer-xsx-reliancedigital",
      merchantId: "reliancedigital",
      price: 49990,
      previousPrice: 52990,
      matchBasis: "exact",
      matchNote: "Same console and 1 TB variant",
      destinationUrl: "https://www.reliancedigital.in/search?q=xbox%20series%20x",
      checkedAt: "2026-08-27T08:56:00.000Z",
    },
  ],
  "xbox-series-s-512gb": [
    {
      id: "offer-xss-flipkart",
      merchantId: "flipkart",
      price: 29990,
      previousPrice: 34990,
      matchBasis: "exact",
      matchNote: "Same console and 512 GB variant",
      destinationUrl: "https://www.flipkart.com/search?q=xbox%20series%20s",
      checkedAt: "2026-08-27T08:53:00.000Z",
    },
    {
      id: "offer-xss-amazon",
      merchantId: "amazon",
      price: 30990,
      previousPrice: 34990,
      matchBasis: "exact",
      matchNote: "Same console and 512 GB variant",
      destinationUrl: "https://www.amazon.in/s?k=xbox+series+s",
      checkedAt: "2026-08-27T08:51:00.000Z",
    },
  ],
};

export const products: readonly Product[] = skuGrid.map((product) => ({
  ...product,
  offers: sampleOffers[product.slug] ?? [],
}));

const merchantById = new Map<string, Merchant>(
  merchants.map((merchant) => [merchant.id, merchant]),
);

export function getMerchant(merchantId: string) {
  return merchantById.get(merchantId);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getOfferById(offerId: string) {
  for (const product of products) {
    const offer = product.offers.find((candidate) => candidate.id === offerId);
    const merchant = offer && merchantById.get(offer.merchantId);

    if (offer && merchant) {
      return { ...offer, product, merchant };
    }
  }

  return undefined;
}

export function isPriced(product: Product) {
  return product.offers.length > 0;
}

/** Environment variable that overrides an offer's destination with an approved deep link. */
export function affiliateEnvKey(offerId: string) {
  return `AFFILIATE_URL_${offerId.replaceAll("-", "_").toUpperCase()}`;
}

export function pricePerGram(product: Product, offer: Offer) {
  return product.kind === "bullion" ? offer.price / product.weightGrams : undefined;
}

/**
 * Distance from the product's reference price, where lower is always better.
 * Bullion measures against the spot rate per gram, devices against launch MRP.
 */
export function referenceDelta(product: Product, offer: Offer) {
  if (product.kind === "bullion") {
    const rate = benchmark.rates[product.category];
    if (!rate) return undefined;
    return {
      percent: (offer.price / product.weightGrams / rate - 1) * 100,
      label: "vs spot",
      reference: `${rate.toLocaleString("en-IN")}/g`,
    };
  }

  return {
    percent: (offer.price / product.mrp - 1) * 100,
    label: "vs MRP",
    reference: product.mrp.toLocaleString("en-IN"),
  };
}

export function comparableOffers(product: Product) {
  return product.offers.filter((offer) => offer.matchBasis !== "similar");
}

export function lowestOffer(product: Product) {
  const pool = comparableOffers(product);
  if (pool.length < 2) return undefined;
  return pool.reduce((best, offer) => (offer.price < best.price ? offer : best));
}

/** Rupees saved by choosing the cheapest seller instead of the dearest. */
export function sellerSpread(product: Product) {
  const pool = comparableOffers(product);
  if (pool.length < 2) return undefined;
  const prices = pool.map((offer) => offer.price);
  return Math.max(...prices) - Math.min(...prices);
}

export function formatWeight(grams: number) {
  return displayWeight(grams);
}

export function productMeta(product: Product) {
  return product.kind === "bullion"
    ? `${product.purity} · ${displayWeight(product.weightGrams)}`
    : `${product.brand} · ${product.variant}`;
}

// ---------------------------------------------------------------------------
// Price history
//
// Sample series generated from a slug-seeded walk so server and client render
// identically. A real feed replaces this with stored daily observations.
// ---------------------------------------------------------------------------

export type PricePoint = { date: string; price: number };

const HISTORY_DAYS = 90;
const HISTORY_END = Date.parse("2026-08-27T00:00:00.000Z");
const DAY_MS = 86_400_000;

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHistory(slug: string, current: number): PricePoint[] {
  const random = mulberry32(hashSeed(slug));
  const points: PricePoint[] = [];
  let value = current;

  // Walk backwards from the current price, then reverse for chronological order.
  for (let day = 0; day < HISTORY_DAYS; day += 1) {
    points.push({
      date: new Date(HISTORY_END - day * DAY_MS).toISOString().slice(0, 10),
      price: Math.round(value),
    });
    const drift = (random() - 0.5) * 0.016;
    value = Math.min(Math.max(value * (1 + drift), current * 0.9), current * 1.18);
  }

  return points.reverse();
}

const historyBySlug = new Map<string, PricePoint[]>();

export function priceHistory(product: Product) {
  const lowest = lowestOffer(product) ?? product.offers[0];
  if (!lowest) return undefined;

  const cached = historyBySlug.get(product.slug);
  if (cached) return cached;

  const series = buildHistory(product.slug, lowest.price);
  historyBySlug.set(product.slug, series);
  return series;
}

export function historyStats(product: Product) {
  const series = priceHistory(product);
  if (!series || series.length === 0) return undefined;

  const prices = series.map((point) => point.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const current = series[series.length - 1].price;
  const lowPoint = series.find((point) => point.price === low);

  return {
    series,
    low,
    high,
    current,
    lowDate: lowPoint?.date,
    /** Percent above the 90-day low; 0 means the current price is the low. */
    aboveLow: ((current - low) / low) * 100,
    isAtLow: current <= low,
  };
}

