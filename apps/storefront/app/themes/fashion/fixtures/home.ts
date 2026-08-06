import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";
import { fashionSourceContract } from "../source-contract";

type SourceProduct = readonly [string, string, string, string, string];

function productFromSource(
  [assetId, name, comparePrice, price, badge]: SourceProduct,
  index: number,
) {
  return {
    assetId,
    badge,
    category: index % 2 === 0 ? "Women" : "Men",
    colors: ["Ochre", "Indigo", "Sage"],
    comparePrice,
    description:
      "A relaxed everyday layer with a considered silhouette, soft hand feel and durable finish.",
    name,
    price,
    sizes: ["S", "M", "L", "XL"],
    sku: `ML-${String(index + 1).padStart(4, "0")}`,
    slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    vendor: "Crafto",
  };
}

const products = fashionSourceContract.bestSellers.map(productFromSource);
const featuredProducts = fashionSourceContract.featuredProducts.map(productFromSource);
const shopProducts = fashionSourceContract.shop.products.map((sourceProduct, index) => ({
  ...productFromSource(sourceProduct, index),
  slug: `${sourceProduct[1].toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}${index > 9 ? `-${index + 1}` : ""}`,
}));

export const fashionHomeFixtures = {
  "fashion-home": {
    id: "fashion-home",
    label: "Fashion reference-backed home presentation",
    pageTypes: ["home", "product", "cart", "checkout", "content"],
    viewModels: {
      header: {
        data: {
          ...fashionSourceContract.header,
        },
        kind: "theme-section",
        state: "populated",
      },
      hero: {
        data: {
          options: fashionSourceContract.hero.options,
          slides: fashionSourceContract.hero.slides,
        },
        kind: "theme-section",
        state: "populated",
      },
      services: {
        data: {
          items: fashionSourceContract.services.map(([assetId, label, detail]) => ({
            assetId,
            detail,
            label,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      categories: {
        data: {
          items: fashionSourceContract.categories.map(([assetId, name, count, href]) => ({
            assetId,
            count,
            href,
            name,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      shop: {
        data: {
          ...fashionSourceContract.shop,
          newArrivals: fashionSourceContract.shop.newArrivals.map(
            ([assetId, name, comparePrice, price]) => ({
              assetId,
              comparePrice,
              name,
              price,
              slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
            }),
          ),
          products: shopProducts,
        },
        kind: "theme-section",
        state: "populated",
      },
      bestsellers: {
        data: { heading: "Best seller products", products },
        kind: "theme-section",
        state: "populated",
      },
      promotion: {
        data: fashionSourceContract.promotion,
        kind: "theme-section",
        state: "populated",
      },
      collection: {
        data: {
          ...fashionSourceContract.collection,
          items: fashionSourceContract.collection.items.map(([assetId, name, tagline]) => ({
            assetId,
            name,
            tagline,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      brands: {
        data: {
          items: fashionSourceContract.brands.map(([assetId, label]) => ({ assetId, label })),
        },
        kind: "theme-section",
        state: "populated",
      },
      featured: {
        data: { heading: "Featured products", products: featuredProducts },
        kind: "theme-section",
        state: "populated",
      },
      product: {
        data: {
          products: shopProducts,
          detailOptions: fashionSourceContract.productDetail,
          relatedHeading: "You may also like",
        },
        kind: "theme-section",
        state: "populated",
      },
      promises: {
        data: {
          items: fashionSourceContract.promises,
          options: fashionSourceContract.promiseMarquee,
        },
        kind: "theme-section",
        state: "populated",
      },
      magazine: {
        data: {
          heading: "Fashion magazine",
          items: fashionSourceContract.magazine.map(([assetId, author, date, title]) => ({
            assetId,
            author,
            date,
            title,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      content: {
        data: {
          magazine: fashionSourceContract.magazine.map(([assetId, author, date, title]) => ({
            assetId,
            author,
            date,
            title,
          })),
          products: shopProducts.map(({ assetId, comparePrice, name, price, slug }) => ({
            assetId,
            comparePrice,
            name,
            price,
            slug,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      cart: {
        checkoutAction: {
          id: "fashion-checkout",
          intent: "checkout.start-preview",
          label: "Proceed to checkout",
        },
        heading: fashionSourceContract.cartPage.heading,
        kind: "cart",
        lines: fashionSourceContract.cartPage.items.map((item, index) => ({
          id: `fashion-cart-line-${index + 1}`,
          name: item.name,
          priceLabel: item.price,
          quantity: item.quantity,
          quantityActions: [
            {
              id: `fashion-cart-decrease-${index + 1}`,
              intent: "cart.quantity-preview",
              label: `Decrease ${item.name} quantity`,
              value: String(Math.max(1, item.quantity - 1)),
            },
            {
              id: `fashion-cart-increase-${index + 1}`,
              intent: "cart.quantity-preview",
              label: `Increase ${item.name} quantity`,
              value: String(item.quantity + 1),
            },
          ],
        })),
        state: "populated",
        subtotalLabel: fashionSourceContract.cartPage.subtotal,
      },
      checkout: {
        action: {
          id: "fashion-place-order",
          intent: "checkout.start-preview",
          label: "Place order",
        },
        heading: fashionSourceContract.checkoutPage.heading,
        kind: "checkout",
        state: "populated",
        steps: ["Billing details", "Additional information", "Your order"],
        summaryLines: fashionSourceContract.cartPage.items.map(
          ({ name, quantity, total }) => `${name} × ${quantity} — ${total}`,
        ),
      },
      footer: {
        data: {
          ...fashionSourceContract.footer,
        },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
