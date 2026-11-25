import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { ADMIN_PERMISSION_KEYS, adminSessionSchema } from "../packages/contracts/src";
import worker from "../apps/admin/worker/index";
import { editorContext, editorRelease } from "../apps/storefront/tests/fixtures/editor-context";

// The production Admin and Vue bundles execute unchanged; only local API transport is a fixture.
const root = resolve(import.meta.dir, "../apps/admin/dist");
const screenshots = resolve(
  import.meta.dir,
  "../.artifacts/screenshots/2026-10-31-storefront-visual-editor",
);
let draft = structuredClone(editorContext.draft);
const writes: Array<{ path: string; body: unknown }> = [];
const library: string[] = [];
let copied: typeof draft | null = null;
let removed = false;
const unexpected: string[] = [];
const session = adminSessionSchema.parse({
  principalKind: "human",
  identityId: "fixture-editor",
  email: "editor@example.test",
  displayName: "Editor fixture",
  environment: "test",
  permissions: [...ADMIN_PERMISSION_KEYS],
  role: {
    id: "role-editor",
    key: "admin",
    name: "Editor",
    enabled: true,
    protected: true,
    system: true,
    version: 1,
  },
});
const release = {
  id: editorRelease.releaseId,
  status: "private-preview",
  environment: "staging",
  approvedAt: editorRelease.generatedAt,
  products: editorRelease.products,
  collections: editorRelease.collections,
  destinations: [],
  menus: [],
};
const api = async (request: Request) => {
  const path = new URL(request.url).pathname;
  const json = (data: unknown) => Response.json({ data });
  if (path === "/admin/session") return json(session);
  if (path === "/admin/storefront-experiences/themes")
    return json([
      {
        ...editorContext.package.manifest,
        presets: editorContext.package.presets.map((preset) => preset.id),
        presetDefinitions: editorContext.package.presets,
      },
    ]);
  if (path === "/admin/storefront-experiences/drafts")
    return json([...(removed ? [] : [draft]), ...(copied ? [copied] : [])]);
  if (path === "/admin/storefront-publications")
    return json({ active: { publication: null, verification: "none" }, publications: [] });
  if (path.endsWith("/library-actions")) {
    const body = (await request.json()) as {
      kind: "rename" | "copy" | "remove";
      name?: string;
      expectedVersion: number;
    };
    if (body.expectedVersion !== draft.version)
      return Response.json(
        { error: { code: "storefront_experience_draft_conflict" } },
        { status: 409 },
      );
    library.push(body.kind);
    if (body.kind === "rename") {
      draft = { ...draft, name: body.name!, version: draft.version + 1 };
      return json(draft);
    }
    if (body.kind === "copy") {
      copied = {
        ...structuredClone(draft),
        id: "draft-editor-copy",
        name: body.name!,
        version: 1,
        experienceId: "storefront-editor-copy",
      };
      return json(copied);
    }
    removed = true;
    return json({ id: draft.id, removedAt: "2026-10-31T00:00:00.000Z" });
  }
  if (path === `/admin/storefront-experiences/drafts/${draft.id}` && request.method === "GET")
    return json(draft);
  if (path.endsWith("/editor-definition"))
    return json({ draft, package: editorContext.package, upgradeTargets: [] });
  if (path.endsWith("/operator-run") || path.endsWith("/preview-context")) return json(null);
  if (path === "/admin/storefront-experiences/catalog-releases") return json([release]);
  if (path.endsWith("/publication-context"))
    return json({
      environment: "staging",
      approval: null,
      active: { publication: null, verification: "none", checkedAt: draft.createdAt },
      publications: [],
    });
  if (path === `/admin/storefront-editor/sessions/${editorContext.id}`)
    return json({ ...editorContext, draft });
  if (path.endsWith("/editor-sessions"))
    return json({
      id: editorContext.id,
      nonce: editorContext.nonce,
      expiresAt: editorContext.expiresAt,
    });
  if (path === `/admin/storefront-experiences/drafts/${draft.id}` && request.method === "PUT") {
    const body = (await request.json()) as {
      overrides: typeof draft.overrides;
      bindings: typeof draft.bindings;
      expectedVersion: number;
    };
    if (body.expectedVersion !== draft.version)
      return Response.json(
        { error: { code: "storefront_experience_draft_conflict" } },
        { status: 409 },
      );
    writes.push({ path, body });
    draft = {
      ...draft,
      overrides: body.overrides,
      bindings: body.bindings,
      version: draft.version + 1,
    };
    return json(draft);
  }
  if (path.endsWith("/resources")) {
    const kind = new URL(request.url).searchParams.get('kind');
    const items = kind === 'product' ? release.products : release.collections;
    return Response.json({ data: items.map(item => ({ ...item, kind, path: `/${kind === 'product' ? 'products' : 'collections'}/${item.slug}` })), page: 1, pageSize: 12, total: items.length });
  }
  unexpected.push(`${request.method} ${path}`);
  return Response.json({ error: { code: "not_found" } }, { status: 404 });
};
const server = Bun.serve({
  port: 0,
  fetch: (request) =>
    worker.fetch(request, {
      ADMIN_HOSTNAME: new URL(request.url).hostname,
      API: { fetch: api },
      ASSETS: {
        fetch: async (request) => {
          let path = new URL(request.url).pathname;
          if (path.endsWith("/")) path += "index.html";
          let file = Bun.file(resolve(root, `.${path}`));
          if (!(await file.exists())) file = Bun.file(resolve(root, "index.html"));
          return new Response(file);
        },
      },
    }),
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    locale: "en-US",
  });
  const errors: string[] = [];
  const choose = async (name: string, value: string) => {
    const control = page.getByRole('combobox', { name, exact: true });
    await control.click();
    const id = await control.getAttribute('aria-controls');
    if (!id) throw new Error(`Missing popup owner for ${name}`);
    const popup = page.locator('.ant-select-dropdown').filter({ has: page.locator(`[id="${id}"]`) });
    await popup.locator('.ant-select-item-option-content').getByText(value, { exact: true }).click();
  };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.error("Browser:", message.text());
  });
  await page.addInitScript(() => localStorage.setItem("shoppp.admin.locale", "en-US"));
  await page.route("https://**", (route) => route.abort());
  const url = `http://127.0.0.1:${server.port}/storefront/themes/${draft.id}?from=setup-guide`;
  await page.goto(url);
  const frame = page.frameLocator('iframe[title="Design preview"]');
  const initial = String(
    editorContext.package.presets[0]!.templates[0]!.sections[0]!.blocks[0]!.settings.title,
  );
  await frame.getByText(initial, { exact: true }).first().waitFor({ timeout: 30_000 });
  await frame.getByText(initial, { exact: true }).first().click();
  const title = page.getByRole("textbox", { name: /^Title$/ });
  const samples: number[] = [];
  for (let index = 0; index < 10; index++) {
    const text = index === 9 ? "Autumn locally verified" : `Warm local edit ${index}`;
    const start = performance.now();
    await title.fill(text);
    await frame.getByText(text, { exact: true }).first().waitFor();
    samples.push(performance.now() - start);
  }
  const p95Ms = [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1]!;
  if (p95Ms > 300)
    throw new Error(`Warm workspace editing exceeded its 300ms p95 target: ${p95Ms}`);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await frame.getByText(initial, { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const image = frame.locator('.fashion-store-decor-hero__product').first();
  const originalImage = await image.getAttribute('src');
  await choose('Product image', 'Product image 2');
  await expect(image).not.toHaveAttribute('src', originalImage!);
  await page.getByRole('button', { name: 'Move down', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Move up', exact: true }).press('Enter');
  await page.getByRole("button", { name: "Save design", exact: true }).press('Enter');
  await expect(page.getByRole("button", { name: "Save design", exact: true })).toBeDisabled();
  if (writes.length !== 1)
    throw new Error(`Expected one whole-document save, received ${writes.length}`);
  await page.reload();
  await frame.getByText("Autumn locally verified", { exact: true }).first().waitFor();
  await frame.getByText("Autumn locally verified", { exact: true }).first().click();
  await expect(page.getByRole("textbox", { name: /^Title$/ })).toHaveValue(
    "Autumn locally verified",
  );
  const category = editorContext.package.presets[0]!.templates[0]!.sections.find(section => section.type === 'fashion-store.categories')!.blocks[0]!;
  await frame.locator(`[data-editor-instance="${category.id}"]`).click();
  await expect(page.locator('.theme-editor-inspector').getByRole('heading', { name: 'Category', exact: true })).toBeVisible();
  const products = page
    .locator(".theme-editor-structure .ant-tree-title")
    .filter({ hasText: /^Products$/ });
  const productCount = await products.count();
  await products.first().click();
  await page
    .locator(".theme-editor-inspector")
    .getByRole("button", { name: "Duplicate", exact: true })
    .click();
  await expect(products).toHaveCount(productCount + 1);
  await page
    .locator(".theme-editor-inspector")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "OK", exact: true }).click();
  await expect(products).toHaveCount(productCount);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(products).toHaveCount(productCount + 1);
  await page.getByRole("button", { name: "Theme styles", exact: true }).click();
  await page.getByRole("textbox", { name: "Accent color", exact: true }).fill("#234567");
  await expect
    .poll(() =>
      frame
        .locator("html")
        .evaluate((node) => getComputedStyle(node).getPropertyValue("--base-color")),
    )
    .toBe("#234567");
  await choose('Font', 'outfit');
  await expect
    .poll(() =>
      frame
        .locator("h1,h2")
        .first()
        .evaluate((node) => getComputedStyle(node).fontFamily),
    )
    .toContain("Outfit");
  await page.getByRole('spinbutton', { name: 'Section spacing', exact: true }).fill('24');
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  await expect(page.getByRole("button", { name: "Save design", exact: true })).toBeDisabled();
  await page.reload();
  await frame.getByText("Autumn locally verified", { exact: true }).first().waitFor();
  await expect(products).toHaveCount(productCount + 1);
  await expect
    .poll(() =>
      frame
        .locator("html")
        .evaluate((node) => getComputedStyle(node).getPropertyValue("--base-color")),
    )
    .toBe("#234567");
  await choose('Preview resource', editorRelease.products[0]!.name);
  await expect.poll(() => frame.locator('html').evaluate(node => getComputedStyle(node).getPropertyValue('--base-color'))).toBe('#234567');
  await expect.poll(() => frame.locator('.site-shell main>section+section').first().evaluate(node => getComputedStyle(node).marginTop)).toBe('24px');
  await choose('Page template', 'Home');
  for (const pageType of ['cart', 'checkout'] as const) {
    await choose('Preview resource', pageType === 'cart' ? 'Cart' : 'Checkout');
    const target = editorContext.package.presets[0]!.templates.find(template => template.pageType === pageType)!;
    await frame.locator(`[data-editor-instance="${target.sections[0]!.id}"]`).waitFor({ state: 'attached' });
  }
  await choose('Page template', 'Home');
  await mkdir(screenshots, { recursive: true });
  const widths = [1440, 768, 320];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) throw new Error(`Workspace overflows at ${width}px`);
    for (const selector of [
      ".theme-editor-preview",
      ".theme-editor-inspector",
      ".theme-editor-toolbar .ant-select",
      ".theme-editor-toolbar .ant-btn",
    ]) {
      const controls = page.locator(selector);
      for (const control of await controls.all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        if (!box || box.width < 60 || box.x < -1 || box.x + box.width > width + 1)
          throw new Error(
            `Clipped workspace control ${selector} at ${width}px: ${JSON.stringify(box)}`,
          );
      }
    }
    await page.getByRole("button", { name: "Back", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(screenshots, `workspace-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByRole("textbox", { name: "Draft name", exact: true }).fill("Renamed autumn");
  await page.getByRole("dialog").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Renamed autumn/ })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Draft name", exact: true }).fill("Autumn copy");
  await page.getByRole("dialog").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open copied draft", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Storefront themes", exact: true })).toBeVisible();
  if (!page.url().endsWith("/storefront/themes?from=setup-guide"))
    throw new Error("The setup guide handoff was lost.");
  if (errors.length || unexpected.length) throw new Error(JSON.stringify({ errors, unexpected }));
  console.log(
    JSON.stringify(
      {
        actualAdminBundle: true,
        actualVueBundle: true,
        clickSelection: true,
        editUndoRedoSaveReopen: true,
        duplicateRemoveUndoSection: true,
        persistedStructureAndStyles: true,
        warmSamples: samples.length,
        p95Ms,
        widths,
        writes: writes.length,
        library,
        guideReturn: true,
        unexpected,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  console.error(
    JSON.stringify({
      unexpected,
      url: page?.url(),
      body: await page?.locator("body").innerText(),
      frames: await Promise.all(
        page
          ?.frames()
          .map(async (frame) => ({
            url: frame.url(),
            body: await frame.locator("body").innerText(),
          })) ?? [],
      ),
    }),
  );
  if (page) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({ path: resolve(screenshots, "workspace-failure.png") });
  }
  throw error;
} finally {
  await browser.close();
  server.stop(true);
}
