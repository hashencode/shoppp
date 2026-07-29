export const catalogRelease = {
  releaseId: "representative-release-2026-07-30",
  site: {
    name: "Shoppp",
    origin: "https://shop.example.invalid",
    defaultCurrency: "USD",
    freshnessHours: 24,
  },
  products: [
    {
      slug: "atlas-carry-on",
      name: "Atlas Carry-on",
      description:
        "A lightweight, impact-resistant carry-on designed for long-haul travel and compact overhead bins.",
      seoTitle: "Atlas Carry-on | Shoppp",
      seoDescription:
        "Meet the Atlas Carry-on: durable shell, quiet wheels, and an international cabin-friendly profile.",
      status: "published",
      collectionSlugs: ["travel-essentials"],
      variants: [
        {
          id: "var_01J00000000000000000000000",
          sku: "ATLAS-BLK",
          title: "Black",
          status: "active",
          optionValues: { color: "Black" },
          weightGrams: 2900,
          prices: [
            { currency: "USD", amount: 12900 },
            { currency: "EUR", amount: 11900 },
          ],
        },
      ],
      media: [
        {
          src: "/media/atlas-carry-on.svg",
          alt: "Black Atlas carry-on suitcase standing upright",
          width: 1200,
          height: 1200,
        },
      ],
    },
  ],
  collections: [
    {
      slug: "travel-essentials",
      name: "Travel essentials",
      description: "Purposeful gear for moving through the world with less friction.",
      seoTitle: "Travel essentials | Shoppp",
      seoDescription: "Browse durable travel essentials for international journeys.",
      status: "published",
      productSlugs: ["atlas-carry-on"],
    },
  ],
  policies: [
    {
      slug: "shipping",
      title: "Shipping policy",
      description:
        "Delivery timing and available services are confirmed from your destination during checkout.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          heading: "Destinations and delivery estimates",
          body: "We show eligible destinations, available services, charges, and estimated delivery timing before payment. An address outside the enabled country list cannot proceed to checkout.",
        },
        {
          heading: "Cross-border charges",
          body: "Cross-border duties, taxes, or carrier charges are shown when the configured service can calculate them. Any amount not collected by us is identified before you place the order.",
        },
        {
          heading: "Tracking and exceptions",
          body: "Shipment notifications include the carrier and tracking reference. Contact support through the secure channel in your order receipt for delivery exceptions.",
        },
      ],
    },
    {
      slug: "returns",
      title: "Returns policy",
      description:
        "Eligible unused items may be returned within 30 days of delivery. Contact support before sending an item back.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          heading: "Return eligibility",
          body: "Contact support within 30 days of delivery before returning an unused item. We will confirm eligibility, the return destination, and any required authorization.",
        },
        {
          heading: "Exclusions",
          body: "Items that are used, damaged after delivery, personalized, or restricted by law may be ineligible. Product-specific exclusions are disclosed before purchase.",
        },
        {
          heading: "Refund timing",
          body: "Approved refunds are sent to the original payment method. Bank and payment-network processing time can vary after the refund is issued.",
        },
      ],
    },
    {
      slug: "privacy",
      title: "Privacy policy",
      description:
        "We collect only the information needed to operate, secure, and improve your purchase experience.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          heading: "Information and purposes",
          body: "We process contact, delivery, order, payment-status, device-security, and support information needed to provide and protect the service. Hosted payment details are handled by the payment provider and are not stored by this storefront.",
        },
        {
          heading: "Retention and your requests",
          body: "Commerce records are retained for operational, fraud-prevention, accounting, and legal obligations. Access, correction, and deletion requests are handled through an audited process; legally required financial records remain immutable.",
        },
        {
          heading: "Providers and international processing",
          body: "Service providers receive only the data needed for payment, delivery, communications, hosting, or security. We do not place optional analytics until the applicable consent requirement is met.",
        },
      ],
    },
    {
      slug: "terms",
      title: "Terms of service",
      description: "These terms govern use of the Shoppp storefront and purchases made through it.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          heading: "Orders and payment",
          body: "An order is accepted only after payment confirmation and inventory convergence. A redirect or confirmation page alone is not proof that payment succeeded.",
        },
        {
          heading: "Pricing and acceptable use",
          body: "Prices, currency, shipping, tax treatment, and the final total are shown before hosted checkout. We may reject abusive, unlawful, or technically invalid transactions.",
        },
        {
          heading: "Consumer rights",
          body: "Product warranties, liability limits, and mandatory consumer rights depend on the enabled market. Nothing in these terms removes rights that cannot lawfully be excluded.",
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      description: "Contact support through the secure channel shown in your order receipt.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          heading: "Order support",
          body: "For an existing order, use the secure support channel in the order receipt and include the public order reference. Never send card numbers, passwords, or guest access links.",
        },
        {
          heading: "Privacy requests",
          body: "For privacy requests, use the privacy contact approved in the launch configuration. We verify the request before exporting data or recording a correction or deletion decision.",
        },
        {
          heading: "Merchant details",
          body: "The merchant's approved legal name, address, and market-specific contact details must be published before production commerce is enabled.",
        },
      ],
    },
    {
      slug: "cookies",
      title: "Cookie disclosure",
      description:
        "Essential storage supports cart and security features. Optional tracking remains disabled until consent.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          heading: "Essential storage",
          body: "Essential browser storage keeps the guest cart, checkout return state, security challenge, and accessibility preferences working. It is not used to build an advertising profile.",
        },
        {
          heading: "Optional tracking",
          body: "Optional analytics and marketing tracking are disabled in the launch implementation. If introduced for an enabled market, they must remain off until the required consent is recorded.",
        },
        {
          heading: "Your controls",
          body: "Clearing essential storage may empty the local cart reference or interrupt checkout. Server-side order and financial records are governed by the privacy and retention process.",
        },
      ],
    },
  ],
  redirects: [{ from: "/products/carry-on", to: "/products/atlas-carry-on" }],
} as const;
