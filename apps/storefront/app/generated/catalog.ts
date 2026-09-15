export const catalogRelease = {
  releaseId: "fashion-store-live-2026-09-13-v1-shopper-release",
  site: {
    defaultCurrency: "USD",
    freshnessHours: 24,
    name: "Shoppp",
    origin: "https://shoppp-storefront-fashion-preview.hashencode.workers.dev",
  },
  collections: [{ name: "Fashion Store", slug: "fashion-store" }],
  policies: [
    {
      description:
        "Delivery timing and available services are confirmed from your destination during checkout.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          body: "We show eligible destinations, available services, charges, and estimated delivery timing before payment. An address outside the enabled country list cannot proceed to checkout.",
          heading: "Destinations and delivery estimates",
        },
        {
          body: "Cross-border duties, taxes, or carrier charges are shown when the configured service can calculate them. Any amount not collected by us is identified before you place the order.",
          heading: "Cross-border charges",
        },
        {
          body: "Shipment notifications include the carrier and tracking reference. Contact support through the secure channel in your order receipt for delivery exceptions.",
          heading: "Tracking and exceptions",
        },
      ],
      slug: "shipping",
      title: "Shipping policy",
    },
    {
      description:
        "Eligible unused items may be returned within 30 days of delivery. Contact support before sending an item back.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          body: "Contact support within 30 days of delivery before returning an unused item. We will confirm eligibility, the return destination, and any required authorization.",
          heading: "Return eligibility",
        },
        {
          body: "Items that are used, damaged after delivery, personalized, or restricted by law may be ineligible. Product-specific exclusions are disclosed before purchase.",
          heading: "Exclusions",
        },
        {
          body: "Approved refunds are sent to the original payment method. Bank and payment-network processing time can vary after the refund is issued.",
          heading: "Refund timing",
        },
      ],
      slug: "returns",
      title: "Returns policy",
    },
    {
      description:
        "We collect only the information needed to operate, secure, and improve your purchase experience.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          body: "We process contact, delivery, order, payment-status, device-security, and support information needed to provide and protect the service. Hosted payment details are handled by the payment provider and are not stored by this storefront.",
          heading: "Information and purposes",
        },
        {
          body: "Commerce records are retained for operational, fraud-prevention, accounting, and legal obligations. Access, correction, and deletion requests are handled through an audited process; legally required financial records remain immutable.",
          heading: "Retention and your requests",
        },
        {
          body: "Service providers receive only the data needed for payment, delivery, communications, hosting, or security. We count anonymous page classes and purchase stages without cookies, URLs, device identifiers, or personal data. Optional analytics remain disabled until the applicable consent requirement is met.",
          heading: "Providers and international processing",
        },
      ],
      slug: "privacy",
      title: "Privacy policy",
    },
    {
      description: "These terms govern use of the Shoppp storefront and purchases made through it.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          body: "An order is accepted only after payment confirmation and inventory convergence. A redirect or confirmation page alone is not proof that payment succeeded.",
          heading: "Orders and payment",
        },
        {
          body: "Prices, currency, shipping, tax treatment, and the final total are shown before hosted checkout. We may reject abusive, unlawful, or technically invalid transactions.",
          heading: "Pricing and acceptable use",
        },
        {
          body: "Product warranties, liability limits, and mandatory consumer rights depend on the enabled market. Nothing in these terms removes rights that cannot lawfully be excluded.",
          heading: "Consumer rights",
        },
      ],
      slug: "terms",
      title: "Terms of service",
    },
    {
      description: "Contact support through the secure channel shown in your order receipt.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          body: "For an existing order, use the secure support channel in the order receipt and include the public order reference. Never send card numbers, passwords, or guest access links.",
          heading: "Order support",
        },
        {
          body: "For privacy requests, use the privacy contact approved in the launch configuration. We verify the request before exporting data or recording a correction or deletion decision.",
          heading: "Privacy requests",
        },
        {
          body: "The merchant's approved legal name, address, and market-specific contact details must be published before production commerce is enabled.",
          heading: "Merchant details",
        },
      ],
      slug: "contact",
      title: "Contact",
    },
    {
      description:
        "Essential storage supports cart and security features. Optional tracking remains disabled until consent.",
      effectiveDate: "2026-07-30",
      sections: [
        {
          body: "Essential browser storage keeps the guest cart, checkout return state, security challenge, and accessibility preferences working. It is not used to build an advertising profile.",
          heading: "Essential storage",
        },
        {
          body: "The launch service counts aggregate page classes and purchase stages without cookies or persistent identifiers. Optional analytics and marketing tracking remain off until the required consent is recorded for an enabled market.",
          heading: "Optional tracking",
        },
        {
          body: "Clearing essential storage may empty the local cart reference or interrupt checkout. Server-side order and financial records are governed by the privacy and retention process.",
          heading: "Your controls",
        },
      ],
      slug: "cookies",
      title: "Cookie disclosure",
    },
  ],
} as const;
