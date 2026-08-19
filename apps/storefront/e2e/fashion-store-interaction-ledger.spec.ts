import { expect, test, type Page } from "@playwright/test";

import {
  assertFashionStoreRenderedInteractionCoverage,
  fashionStoreInteractionContract,
  type RenderedInteractionCandidateEvidence,
} from "../app/themes/fashion-store/interaction-contract";
import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";

const sharedShellBehaviorIds = new Set([
  "back-to-top-control",
  "desktop-social-rail",
  "footer-sticky-reveal",
  "header-cart-preview",
  "header-search-overlay",
  "header-shop-navigation",
  "scroll-progress-indicator",
]);
const fixtureOnlyUnrenderedRows = [
  {
    id: "fashion-store-home-header-cart-preview-2",
    reason:
      "The fixture-preview MiniCart has no mutable Commerce line; live coverage proves its remove control.",
  },
] as const;

async function prepare(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    ["loading", "ready", "static"].includes(
      document
        .querySelector("[data-fashion-store-source-parity]")
        ?.getAttribute("data-runtime-status") ?? "",
    ),
  );
}

test("every rendered Fashion Store candidate maps to exactly one semantic row", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Ledger audit runs once.");

  const renderedInteractionIds = new Set<string>();
  for (const contract of fashionStorePageContracts) {
    await prepare(page, contract.path);
    const routeId = `fashion-store-${contract.id}`;
    const rows = fashionStoreInteractionContract
      .filter(
        (row) =>
          row.routeId === routeId ||
          row.routeId === "fashion-store-shared" ||
          (row.routeId === "fashion-store-home" && sharedShellBehaviorIds.has(row.behaviorId)),
      )
      .map(({ behaviorId, candidate, id, routeId: governedRouteId }) => ({
        behaviorId,
        candidate,
        governedRouteId,
        id,
      }));
    const { candidates, matchedInteractionIds } = await page.evaluate(
      ({ governedRows, renderedRouteId, sharedBehaviorIds }) => {
        const sharedBehaviors = new Set(sharedBehaviorIds);
        const elements = [
          ...document.querySelectorAll<HTMLElement>(
            "a[href], a[data-fashion-store-route], button, form, [role='button'][tabindex]",
          ),
        ];
        const candidates = elements.map((element, index) => {
          const matches = governedRows.flatMap((row) => {
            try {
              if (element.matches(row.candidate)) return [{ direct: true, row }];
              if (row.behaviorId === "hero-native-cursor") return [];
              return element.closest(row.candidate) ? [{ direct: false, row }] : [];
            } catch {
              return [];
            }
          });
          const priority = (match: (typeof matches)[number]) => {
            let rowPriority = 1;
            if (match.row.governedRouteId === renderedRouteId) rowPriority = 4;
            else if (
              match.row.governedRouteId === "fashion-store-home" &&
              sharedBehaviors.has(match.row.behaviorId)
            )
              rowPriority = 3;
            else if (
              match.row.governedRouteId === "fashion-store-shared" &&
              !match.row.behaviorId.startsWith("shared-route-")
            )
              rowPriority = 2;
            return Number(match.direct) * 10 + rowPriority;
          };
          const highestPriority = matches.reduce(
            (highest, row) => Math.max(highest, priority(row)),
            0,
          );
          const resolvedMatches = matches.filter((match) => priority(match) === highestPriority);
          return {
            candidate: `${element.tagName.toLowerCase()}#${element.id || index}:${element.textContent?.trim().slice(0, 40) ?? ""}`,
            interactionIds: resolvedMatches.map(({ row }) => row.id),
            routeId: renderedRouteId,
          };
        });
        const matchedInteractionIds = new Set(
          candidates.flatMap(({ interactionIds }) => interactionIds),
        );
        const interactiveElements = new Set(elements);
        for (const { candidate, id } of governedRows) {
          try {
            const passiveSurfaceRendered = [...document.querySelectorAll(candidate)].some(
              (element) => !interactiveElements.has(element as HTMLElement),
            );
            if (passiveSurfaceRendered) matchedInteractionIds.add(id);
          } catch {
            // Invalid selectors remain uncredited and fail the reverse coverage assertion.
          }
        }
        return { candidates, matchedInteractionIds: [...matchedInteractionIds] };
      },
      {
        governedRows: rows,
        renderedRouteId: routeId,
        sharedBehaviorIds: [...sharedShellBehaviorIds],
      },
    );
    for (const id of matchedInteractionIds) renderedInteractionIds.add(id);
    expect(() =>
      assertFashionStoreRenderedInteractionCoverage(
        candidates as RenderedInteractionCandidateEvidence[],
        fashionStoreInteractionContract,
      ),
    ).not.toThrow();
  }

  const unrenderedRows = fashionStoreInteractionContract
    .filter(({ id }) => !renderedInteractionIds.has(id))
    .map(({ id }) => id);
  const fixtureOnlyIds = new Set(fixtureOnlyUnrenderedRows.map(({ id }) => id));
  expect(unrenderedRows.filter((id) => !fixtureOnlyIds.has(id))).toEqual([]);
  for (const { id, reason } of fixtureOnlyUnrenderedRows) {
    expect(unrenderedRows, reason).toContain(id);
  }
});

test("no-JavaScript shell keeps truthful native browse recovery", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "No-JavaScript audit runs once.");
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(new URL("/", baseURL).toString(), { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("region", { name: "JavaScript limitations" })).toContainText(
      "Shopping actions require JavaScript",
    );
    await expect(page.getByRole("link", { name: "Browse the published catalog" })).toHaveAttribute(
      "href",
      "/shop",
    );
  } finally {
    await context.close();
  }
});
