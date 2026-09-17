import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "../apps/storefront/node_modules/sharp";
import {
  validateFashionStoreLiveCatalog,
  verifyFashionStoreLiveCatalogMedia,
  type FashionStoreLiveCatalog,
} from "./prepare-fashion-store-live-catalog";

const repositoryRoot = resolve(import.meta.dir, "..");
const sourcePath = resolve(import.meta.dir, "fashion-store-live-catalog.json");
const outputPath = resolve(import.meta.dir, "fashion-store-product-content-catalog.json");
const provenancePath = resolve(
  import.meta.dir,
  "fashion-store-product-content-media-provenance.json",
);

const visuallyVerified = [
  {
    name: "Pale blue graphic crew-neck T-shirt",
    color: "Pale blue",
    category: "T-shirts",
    neck: "Crew neck",
    sleeve: "Short sleeves",
    feature: "Small white graphic on the chest",
    description: "Pale blue short-sleeve T-shirt with a crew neck and a small white chest graphic.",
    detail:
      "A softly colored everyday T-shirt with a small chest graphic visible in the product photo.",
  },
  {
    name: "Ivory button-front cardigan",
    color: "Ivory",
    category: "Cardigans",
    neck: "Round neck",
    sleeve: "Long sleeves",
    feature: "Button front",
    description: "Ivory long-sleeve cardigan with a round neck and a button front.",
    detail: "A light-colored cardigan with a row of front buttons and long sleeves.",
  },
  {
    name: "Sage green crew-neck T-shirt",
    color: "Sage green",
    category: "T-shirts",
    neck: "Crew neck",
    sleeve: "Short sleeves",
    feature: "Plain front",
    description: "Sage green short-sleeve T-shirt with a crew neck and a plain front.",
    detail: "The muted green front is unprinted, with a classic crew neckline.",
  },
  {
    name: "Cream open-front cardigan",
    color: "Cream",
    category: "Cardigans",
    neck: "Open front",
    sleeve: "Long sleeves",
    feature: "Textured surface; inner top shown separately",
    description: "Cream textured open-front cardigan shown over a separate cream inner top.",
    detail:
      "The cardigan has an open front and visible texture. The cropped inner top in the photo is a separate styling piece.",
  },
  {
    name: "Taupe ribbed sleeveless top",
    color: "Taupe",
    category: "Tops",
    neck: "Scoop neck",
    sleeve: "Sleeveless",
    feature: "Visible ribbed texture",
    description: "Taupe sleeveless top with a scoop neckline and visible ribbed texture.",
    detail: "A sleeveless top with a scooped neckline and narrow vertical ribbing.",
  },
  {
    name: "White graphic crew-neck T-shirt",
    color: "White",
    category: "T-shirts",
    neck: "Crew neck",
    sleeve: "Short sleeves",
    feature: "Black lettering on the front",
    description: "White short-sleeve T-shirt with a crew neck and black front lettering.",
    detail: "The product photo shows black lettering across the center front.",
  },
  {
    name: "Light gray tie-neck blouse",
    color: "Light gray",
    category: "Blouses",
    neck: "Tie neck",
    sleeve: "Long sleeves",
    feature: "Front neck tie",
    description: "Light gray long-sleeve blouse with a front neck tie and subtle vertical texture.",
    detail: "The neckline closes with a soft tie. Subtle vertical texture is visible on the front.",
  },
  {
    name: "Black crew-neck T-shirt",
    color: "Black",
    category: "T-shirts",
    neck: "Crew neck",
    sleeve: "Short sleeves",
    feature: "Plain front; bag shown separately",
    description:
      "Black short-sleeve T-shirt with a plain front, styled with a separate crossbody bag.",
    detail:
      "A plain black crew-neck T-shirt. The crossbody bag in the photo is a separate styling piece.",
  },
  {
    name: "Navy single-button blazer",
    color: "Navy",
    category: "Blazers",
    neck: "Notched lapel",
    sleeve: "Long sleeves",
    feature: "Single front button and chest welt pocket",
    description:
      "Dark navy blazer with a notched lapel, single front button, and chest welt pocket.",
    detail:
      "The blazer has a single-button front and a visible chest welt pocket. The light inner top is a separate styling piece.",
  },
  {
    name: "Pale blue popover shirt",
    color: "Pale blue",
    category: "Shirts",
    neck: "Open pointed collar",
    sleeve: "Long sleeves",
    feature: "Open V-shaped neckline",
    description:
      "Pale blue long-sleeve popover shirt with an open pointed collar and V-shaped neckline.",
    detail: "The open collar creates a V-shaped front neckline; the sleeves are long.",
  },
  {
    name: "Light heather-gray crew-neck sweatshirt",
    color: "Light heather gray",
    category: "Sweatshirts",
    neck: "Crew neck",
    sleeve: "Long sleeves",
    feature: "Plain front",
    description: "Light heather-gray long-sleeve sweatshirt with a crew neck and plain front.",
    detail: "A plain-front sweatshirt in a light heather-gray shade.",
  },
  {
    name: "Pale gray button-front blouse",
    color: "Pale gray-green",
    category: "Blouses",
    neck: "Pointed collar",
    sleeve: "Long sleeves",
    feature: "Button front",
    description: "Pale gray-green long-sleeve blouse with a pointed collar and button front.",
    detail: "The blouse has a pointed collar and visible front buttons.",
  },
] as const;

const acceptedImageNumbers = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]);

async function main() {
  const original = JSON.parse(await readFile(sourcePath, "utf8")) as FashionStoreLiveCatalog;
  const catalog: FashionStoreLiveCatalog = structuredClone(original);
  catalog.catalogVersion = "fashion-store-product-content-2026-09-17-v4";
  const provenance: Array<Record<string, unknown>> = [];

  for (const product of catalog.products) {
    const index = product.shopCardOrder;
    if (index === null) {
      product.name = "Button-front shirt";
      product.description =
        "Long-sleeve shirt with a pointed collar, button front, and chest patch pocket. Available in four demonstration colors.";
      product.brand = null;
      product.taxonomy.categories = ["Shirts"];
      product.taxonomy.colors = ["Charcoal", "Gold", "Blue", "Green"];
      product.taxonomy.sizes = ["S", "M", "L", "XL"];
      product.taxonomy.tags = [];
      product.optionDefinitions = [
        {
          name: "color",
          presentation: "color",
          values: [
            { label: "Charcoal", swatch: "#393a3d" },
            { label: "Gold", swatch: "#b28a46" },
            { label: "Blue", swatch: "#4f7391" },
            { label: "Green", swatch: "#6d7653" },
          ],
        },
        {
          name: "size",
          presentation: "text",
          values: product.taxonomy.sizes.map((label) => ({ label })),
        },
      ];
      const historicalVariants = product.variants;
      const samplePrice = historicalVariants[0]!.price;
      const charcoalVariants = product.taxonomy.sizes.map((size) => ({
        id: `var_01JF12CHARCOALSHIRT${size.padEnd(5, "0")}`,
        sku: `DEMO-CHARCOAL-SHIRT-${size}`,
        title: `Charcoal / ${size}`,
        optionValues: { color: "Charcoal", size },
        price: samplePrice,
        inventory: { onHand: 20, oversellLimit: 0 },
        status: "active",
        weightGrams: null,
      }));
      product.variants = [
        ...charcoalVariants,
        ...historicalVariants.map((variant) => {
          const color =
            variant.optionValues.color[0]!.toUpperCase() + variant.optionValues.color.slice(1);
          return {
            ...variant,
            title: `${color} / ${variant.optionValues.size}`,
            optionValues: { color, size: variant.optionValues.size },
          };
        }),
      ];
      product.media = product.media.slice(0, 4);
      const views = ["front view", "back view", "alternate front view", "flat product view"];
      product.media.forEach((media, mediaIndex) => {
        media.alt = `${product.name}, ${views[mediaIndex]}`;
      });
      const charcoalMediaIds = product.media.map(({ id }) => id);
      const colorMediaIds: Record<string, string[]> = { Charcoal: charcoalMediaIds };
      for (const color of ["Gold", "Blue", "Green"] as const) {
        const filename = `charcoal-shirt-${color.toLowerCase()}-front-v1.jpg`;
        const sourcePath = `apps/storefront/public/media/fashion-store-generated/${filename}`;
        const bytes = await readFile(resolve(repositoryRoot, sourcePath));
        const metadata = await sharp(bytes).metadata();
        if (metadata.format !== "jpeg" || !metadata.width || !metadata.height)
          throw new Error(`Invalid generated image ${sourcePath}`);
        const media = {
          id: `media_01JFS12SHIRT${color.toUpperCase()}FRONT001`,
          sourcePath,
          r2Key: `catalog/products/${product.id}/fashion-store-f12/${filename}`,
          mimeType: "image/jpeg" as const,
          width: metadata.width,
          height: metadata.height,
          sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
          alt: `${color} button-front shirt, front view`,
          order: product.media.length + 1,
        };
        product.media.push(media);
        colorMediaIds[color] = [media.id];
        provenance.push({
          productId: product.id,
          productSlug: product.slug,
          permission:
            "User confirmed derivative rights and requested multiple demonstration colors with matching images on 2026-09-17",
          sourceHeadPath: original.products.find(({ id }) => id === product.id)!.media[0]!
            .sourcePath,
          sourceHeadSha256: original.products.find(({ id }) => id === product.id)!.media[0]!.sha256,
          generator: "OpenAI image_gen image edit of the charcoal Product head photo",
          review: `Accepted ${color} front image after visual comparison of garment collar, pocket, buttons, color, and crop`,
          generatedMedia: media,
        });
      }
      product.presentation = {
        defaultVariantId: charcoalVariants[1]!.id,
        colorMediaIds,
        detail: {
          body: "The photographs show the same shirt shape in four demonstration colors, with a pointed collar, button front, long sleeves, and chest patch pocket.",
          bullets: ["Pointed collar", "Long sleeves", "Front buttons and chest patch pocket"],
          heading: product.name,
        },
        specifications: [
          { label: "Available colors", value: product.taxonomy.colors.join(", ") },
          { label: "Collar", value: "Pointed collar" },
          { label: "Sleeve", value: "Long sleeves" },
          { label: "Visible detail", value: "Front buttons and chest patch pocket" },
        ],
      };
      continue;
    }
    const fact = visuallyVerified[index - 1];
    if (!fact) throw new Error(`Missing visually verified facts for ${product.id}`);
    const head = product.media[0];
    const variant = product.variants[0];
    if (!head || !variant || product.variants.length !== 1)
      throw new Error(`Unexpected source shape for ${product.id}`);

    product.name = fact.name;
    product.description = fact.description;
    product.taxonomy.categories = [fact.category];
    product.taxonomy.colors = [fact.color];
    product.taxonomy.tags = [];
    product.optionDefinitions[0] = {
      name: "color",
      presentation: "text",
      values: [{ label: fact.color }],
    };
    variant.optionValues.color = fact.color;
    variant.title = `${fact.color} / ${variant.optionValues.size}`;
    head.alt = `${fact.name}, front view`;
    product.presentation = {
      defaultVariantId: variant.id,
      detail: {
        body: fact.detail,
        bullets: [fact.neck, fact.sleeve, fact.feature],
        heading: fact.name,
      },
      specifications: [
        { label: "Color", value: fact.color },
        { label: "Neckline", value: fact.neck },
        { label: "Sleeve", value: fact.sleeve },
        { label: "Visible detail", value: fact.feature },
      ],
    };

    if (!acceptedImageNumbers.has(index)) continue;
    const number = String(index).padStart(2, "0");
    const generatedPath = `apps/storefront/public/media/fashion-store-generated/product-${number}-detail-v1.jpg`;
    const bytes = await readFile(resolve(repositoryRoot, generatedPath));
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== "jpeg" || !metadata.width || !metadata.height)
      throw new Error(`Invalid generated image ${generatedPath}`);
    const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    const media = {
      id: `media_01JFS12SHOPDETAIL0000000${number}`,
      sourcePath: generatedPath,
      r2Key: `catalog/products/${product.id}/fashion-store-f12/product-${number}-detail-v1.jpg`,
      mimeType: "image/jpeg" as const,
      width: metadata.width,
      height: metadata.height,
      sha256,
      alt: `${fact.name}, close view of ${fact.feature.toLowerCase()}`,
      order: 2,
    };
    product.media.push(media);
    provenance.push({
      productId: product.id,
      productSlug: product.slug,
      permission:
        "User confirmed on 2026-09-17 that existing head photos may be used for derivative generation",
      sourceHeadPath: head.sourcePath,
      sourceHeadSha256: head.sha256,
      generator: "OpenAI image_gen image edit using this Product's head photo as reference",
      review:
        "Accepted after visual comparison with the head photo; garment color, shape, and visible details checked",
      generatedMedia: media,
    });
  }

  validateFashionStoreLiveCatalog(catalog);
  await verifyFashionStoreLiveCatalogMedia(catalog, repositoryRoot);
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(
    provenancePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        catalogVersion: catalog.catalogVersion,
        accepted: provenance,
        rejected: [
          {
            productId: catalog.products[5]?.id,
            reason:
              "Generated T-shirt omitted the black front lettering visible on the head photo; original one-image gallery retained",
          },
        ],
        leadProduct:
          "Original charcoal media 01-04 and three reviewed AI-derived color fronts are in the successor release. Pale-yellow media 05-06 remain excluded. Historical Gold/Blue/Green SKU identities and new demonstration Charcoal SKUs form a four-color sample assortment; remote Commerce inventory is not yet synchronized.",
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Prepared ${catalog.products.length} Products, ${catalog.products.flatMap((product) => product.variants).length} Variants, ${catalog.products.flatMap((product) => product.media).length} media objects`,
  );
}

if (import.meta.main) await main();
