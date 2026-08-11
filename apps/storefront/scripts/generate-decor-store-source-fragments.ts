import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { format } from "prettier";

export interface DecorStoreSourceFragments {
  body: string;
  header: string;
  hero: string;
  tail: string;
}

const storefrontRoot = resolve(import.meta.dir, "..");
const sourcePath = resolve(storefrontRoot, "app/themes/decor-store/upstream/demo-decor-store.html");
const generatedPath = resolve(
  storefrontRoot,
  "app/themes/decor-store/runtime/source-fragments.generated.ts",
);

function between(source: string, start: string, end: string, from = 0): string {
  const startIndex = source.indexOf(start, from);
  if (startIndex < 0) throw new Error(`Decor source marker is missing: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error(`Decor source marker is missing: ${end}`);
  return source.slice(startIndex, endIndex + end.length);
}

export function extractDecorStoreSourceFragments(source: string): DecorStoreSourceFragments {
  const sectionPattern =
    /<!-- start section -->\s*(<section[\s\S]*?<\/section>)\s*<!-- end section -->/g;
  const sourceSections = [...source.matchAll(sectionPattern)].map((match) => match[1]);
  const bodyRegionKeys = [
    "featured-categories",
    "products",
    "promotional-marquee",
    "collection-carousel",
    "client-marquee",
    "journal",
    "services",
  ] as const;
  if (sourceSections.length !== bodyRegionKeys.length + 1)
    throw new Error(`Expected eight Decor source sections, received ${sourceSections.length}.`);

  const footerStart = source.indexOf("<!-- start footer -->");
  const scrollProgressEnd = source.indexOf("<!-- end scroll progress -->", footerStart);
  if (footerStart < 0 || scrollProgressEnd < 0)
    throw new Error("The Decor source footer and fixed-control tail is missing.");

  const productGridIndex = source.indexOf(">Best sellers<");
  const tableClockIndex = source.indexOf(
    'src="images/demo-decor-store-product-01.jpg"',
    productGridIndex,
  );
  if (tableClockIndex < 0)
    throw new Error("The representative Table clock card is missing from the Decor source.");

  return {
    body: bodyRegionKeys
      .map((key, index) => {
        const section = sourceSections[index + 1];
        if (!section) throw new Error(`The ${key} Decor source section is missing.`);
        return section
          .replace("<section", `<section data-decor-region="${key}"`)
          .replaceAll(/\sdata-anime='[^']*'/g, "")
          .replaceAll("grid-loading ", "");
      })
      .join("\n"),
    header: between(source, '<header class="header-with-topbar">', "</header>"),
    hero: between(source, '<section class="p-0">', "</section>").replaceAll(
      /\sdata-thumb="https?:\/\/[^"]*"/g,
      "",
    ),
    tail: source
      .slice(footerStart, scrollProgressEnd + "<!-- end scroll progress -->".length)
      .replace(
        'action="email-templates/subscribe-newsletter.php" method="post"',
        'action="" data-decor-newsletter-form="" aria-label="Newsletter presentation"',
      )
      .replace(
        '<button class="btn pe-20px submit" aria-label="submit">',
        '<button type="button" class="btn pe-20px submit" aria-label="Newsletter unavailable in preview" aria-disabled="true">',
      )
      .replace(
        'class="btn btn-transparent-white border-1 border-color-transparent-white-light btn-very-small btn-switch-text btn-rounded w-100 mb-15px" aria-label="btn"',
        'class="btn btn-transparent-white border-1 border-color-transparent-white-light btn-very-small btn-switch-text btn-rounded w-100 mb-15px" data-cookie-choice="reject" aria-label="Reject cookies"',
      )
      .replace(
        'class="btn btn-white btn-very-small btn-switch-text btn-box-shadow accept_cookies_btn btn-rounded w-100" data-accept-btn aria-label="text"',
        'class="btn btn-white btn-very-small btn-switch-text btn-box-shadow accept_cookies_btn btn-rounded w-100" data-accept-btn data-cookie-choice="accept" aria-label="Allow cookies"',
      )
      .replace(
        'class="scroll-top" aria-label="scroll"',
        'class="scroll-top" role="button" aria-label="Back to top"',
      )
      .replaceAll('href="#"', 'href="/" data-decor-route-intent="navigation"'),
  };
}

export async function renderDecorStoreSourceFragments(
  fragments: DecorStoreSourceFragments,
): Promise<string> {
  const source = [
    "// Generated from the frozen Decor source. Run the generator instead of editing this file.",
    `export const decorStoreHeaderSourceMarkup = ${JSON.stringify(fragments.header)} as const;`,
    `export const decorStoreHeroSourceMarkup = ${JSON.stringify(fragments.hero)} as const;`,
    `export const decorStoreBodySourceMarkup = ${JSON.stringify(fragments.body)} as const;`,
    `export const decorStoreTailSourceMarkup = ${JSON.stringify(fragments.tail)} as const;`,
    "",
  ].join("\n");
  return format(source, { parser: "typescript" });
}

export async function generateDecorStoreSourceFragments(check = false): Promise<void> {
  const rendered = await renderDecorStoreSourceFragments(
    extractDecorStoreSourceFragments(await readFile(sourcePath, "utf8")),
  );
  if (check) {
    const current = await readFile(generatedPath, "utf8").catch(() => "");
    if (current !== rendered)
      throw new Error(
        "Decor source fragments drifted; run generate-decor-store-source-fragments.ts.",
      );
    return;
  }
  await writeFile(generatedPath, rendered);
}

if (import.meta.main) await generateDecorStoreSourceFragments(Bun.argv.includes("--check"));
