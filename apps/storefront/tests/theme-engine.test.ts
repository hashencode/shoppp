import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type {
  ExperienceSnapshot,
  PageTemplate,
  StorefrontThemeDescriptor,
} from "@shoppp/contracts";
import type { Component } from "vue";

import {
  experienceBuildInputSchema,
  prepareExperience,
  renderActiveThemeModule,
} from "../scripts/prepare-experience";
import { packagePreviewArtifact } from "../scripts/package-preview-artifact";
import {
  composeThemeRegistries,
  renderTemplatePlan,
  type ThemeRegistry,
} from "../app/theme-engine/registry";
import {
  createPreviewAccessHandler,
  normalizePreviewAssetPath,
  uploadPreviewArtifact,
  type PreviewArtifactBucket,
  type PreviewArtifactObject,
} from "../worker/preview-access";

const descriptor = {
  configurationSchemaVersion: 1,
  id: "fashion",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  presets: ["editorial"],
  supportedPageTemplates: ["home"],
  themeVersion: "1.0.0",
} satisfies StorefrontThemeDescriptor;

const template = {
  id: "home",
  pageType: "home",
  requiredCapabilities: ["legal.links"],
  sections: [
    {
      blocks: [
        {
          actions: [],
          capabilities: [],
          id: "hero-action",
          settings: { label: "Explore" },
          type: "core.action",
          visible: true,
        },
      ],
      capabilities: [],
      id: "hero",
      settings: { heading: "Editorial" },
      type: "fashion.hero",
      visible: true,
    },
    {
      blocks: [],
      capabilities: [],
      id: "disabled",
      settings: {},
      type: "fashion.editorial",
      visible: false,
    },
    {
      blocks: [],
      capabilities: ["legal.links"],
      id: "legal-footer",
      required: true,
      settings: {},
      type: "core.legal-footer",
      visible: true,
    },
  ],
} satisfies PageTemplate;

const snapshot = {
  approvedAt: "2026-07-30T01:00:00.000Z",
  approvedBy: "operator-1",
  bindings: [],
  configurationSchemaVersion: 1,
  experienceId: "experience-fashion",
  id: "snapshot-fashion-1",
  kind: "approved",
  overrides: [],
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "theme-team",
    license: "Internal",
    source: "internal://fashion",
  },
  resolvedTemplates: [template],
  themeId: "fashion",
  themeVersion: "1.0.0",
  version: 1,
} satisfies ExperienceSnapshot;

const previewInput = {
  environment: "preview",
  expectedOrigin: "https://preview.example.test",
  snapshot,
  themeId: "fashion",
} as const;

describe("selected storefront theme generation", () => {
  test("generates an unchanged fallback without importing a theme", () => {
    const source = renderActiveThemeModule({
      catalog: [],
      input: { environment: "production" },
      moduleAllowlist: {},
    });

    expect(source).toContain('"production-fallback"');
    expect(source).not.toContain("/themes/");
    expect(source).not.toContain("snapshot-fashion-1");
  });

  test("generates one deterministic allowlisted import for a compatible preview", () => {
    const options = {
      catalog: [descriptor],
      input: previewInput,
      moduleAllowlist: {
        decor: "../themes/decor/registry",
        fashion: "../themes/fashion/registry",
      },
    };
    const first = renderActiveThemeModule(options);
    const second = renderActiveThemeModule(options);

    expect(second).toBe(first);
    expect(first).toContain('from "../themes/fashion/registry"');
    expect(first).not.toContain("../themes/decor/registry");
    expect(first).toContain('"snapshot-fashion-1"');
  });

  test("rejects unknown, incompatible, unapproved, or caller-supplied module paths", () => {
    expect(() =>
      renderActiveThemeModule({
        catalog: [],
        input: previewInput,
        moduleAllowlist: { fashion: "../themes/fashion/registry" },
      }),
    ).toThrow("catalog");
    expect(() =>
      renderActiveThemeModule({
        catalog: [
          {
            ...descriptor,
            platformCompatibility: { maxExclusive: "3.0.0", min: "2.0.0" },
          },
        ],
        input: previewInput,
        moduleAllowlist: { fashion: "../themes/fashion/registry" },
      }),
    ).toThrow("compatible");
    expect(() =>
      renderActiveThemeModule({
        catalog: [{ ...descriptor, id: "rogue" }],
        input: { ...previewInput, snapshot: { ...snapshot, themeId: "rogue" }, themeId: "rogue" },
        moduleAllowlist: {},
      }),
    ).toThrow("allowlist");
    expect(
      experienceBuildInputSchema.safeParse({
        ...previewInput,
        modulePath: "../../attacker/module",
      }).success,
    ).toBe(false);
    expect(
      experienceBuildInputSchema.safeParse({
        ...previewInput,
        expectedOrigin: "https://preview.example.test/",
      }).success,
    ).toBe(false);
  });

  test("writes the generated module to a fixed output path", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-active-theme-"));
    try {
      const outputPath = resolve(directory, "active-theme.ts");
      await prepareExperience({
        catalog: [descriptor],
        input: previewInput,
        moduleAllowlist: { fashion: "../themes/fashion/registry" },
        outputPath,
      });
      expect(await readFile(outputPath, "utf8")).toBe(
        renderActiveThemeModule({
          catalog: [descriptor],
          input: previewInput,
          moduleAllowlist: { fashion: "../themes/fashion/registry" },
        }),
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

describe("typed theme registry", () => {
  const components = {
    action: {} as Component,
    footer: {} as Component,
    hero: {} as Component,
  };
  const core = {
    blocks: { "core.action": components.action },
    sections: { "core.legal-footer": components.footer },
  } satisfies ThemeRegistry;
  const fashion = {
    blocks: {},
    sections: {
      "fashion.editorial": {} as Component,
      "fashion.hero": components.hero,
    },
  } satisfies ThemeRegistry;

  test("composes core and namespaced registries and keeps configured order", () => {
    const plan = renderTemplatePlan(template, composeThemeRegistries(core, fashion));

    expect(plan.map(({ instance }) => instance.id)).toEqual(["hero", "legal-footer"]);
    expect(plan[0]?.component).toBe(components.hero);
    expect(plan[0]?.blocks.map(({ instance }) => instance.id)).toEqual(["hero-action"]);
    expect(plan[1]?.component).toBe(components.footer);
  });

  test("rejects duplicate registrations and unknown visible components", () => {
    expect(() =>
      composeThemeRegistries(core, {
        blocks: { "core.action": {} as Component },
        sections: {},
      }),
    ).toThrow("duplicate");
    expect(() =>
      renderTemplatePlan(
        {
          ...template,
          sections: [{ ...template.sections[0]!, type: "fashion.unknown" }],
        },
        composeThemeRegistries(core, fashion),
      ),
    ).toThrow("not registered");
  });
});

class MemoryBucket implements PreviewArtifactBucket {
  readonly objects = new Map<
    string,
    {
      body: Uint8Array;
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    }
  >();
  puts = 0;

  async get(key: string): Promise<PreviewArtifactObject | null> {
    const value = this.objects.get(key);
    if (!value) return null;
    return {
      body: value.body,
      customMetadata: value.customMetadata,
      httpMetadata: value.httpMetadata,
    };
  }

  async head(key: string): Promise<PreviewArtifactObject | null> {
    return this.get(key);
  }

  async put(
    key: string,
    body: Uint8Array,
    options: {
      customMetadata: Record<string, string>;
      httpMetadata: { contentType: string };
    },
  ): Promise<void> {
    this.puts += 1;
    this.objects.set(key, {
      body: structuredClone(body),
      customMetadata: options.customMetadata,
      httpMetadata: options.httpMetadata,
    });
  }
}

const previewFiles = [
  {
    body: new TextEncoder().encode("<!doctype html><h1>Preview</h1>"),
    contentType: "text/html; charset=utf-8",
    path: "index.html",
  },
  {
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    path: "_nuxt/image.png",
  },
];

describe("private preview artifacts", () => {
  test("uploads identical output idempotently and isolates snapshot prefixes", async () => {
    const bucket = new MemoryBucket();
    const first = await uploadPreviewArtifact(bucket, "snapshot-fashion-1", previewFiles);
    const putCount = bucket.puts;
    const repeated = await uploadPreviewArtifact(bucket, "snapshot-fashion-1", previewFiles);
    const other = await uploadPreviewArtifact(bucket, "snapshot-fashion-2", previewFiles);

    expect(repeated).toEqual(first);
    expect(bucket.puts).toBe(putCount + previewFiles.length + 1);
    expect(other.digest).toBe(first.digest);
    expect(other.prefix).not.toBe(first.prefix);
    await expect(
      uploadPreviewArtifact(bucket, "snapshot-fashion-1", previewFiles, "0".repeat(64)),
    ).rejects.toThrow("digest");
  });

  test("normalizes assets and rejects traversal including encoded traversal", () => {
    expect(normalizePreviewAssetPath("/")).toBe("index.html");
    expect(normalizePreviewAssetPath("/products/")).toBe("products/index.html");
    expect(normalizePreviewAssetPath("/_nuxt/app.js")).toBe("_nuxt/app.js");
    for (const path of ["/../secret", "/%2e%2e/secret", "/%252e%252e/secret", "/a\\b"]) {
      expect(() => normalizePreviewAssetPath(path)).toThrow("path");
    }
  });

  test("packages complete static output with declared content types", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-preview-output-"));
    try {
      const output = resolve(directory, "public");
      const manifestPath = resolve(directory, "artifact-manifest.json");
      await mkdir(resolve(output, "_nuxt"), { recursive: true });
      await Promise.all([
        writeFile(resolve(output, "index.html"), "<!doctype html><h1>Preview</h1>"),
        writeFile(resolve(output, "_nuxt/app.js"), "export {};\n"),
      ]);

      const artifact = await packagePreviewArtifact({
        manifestPath,
        outputRoot: output,
        snapshotId: "snapshot-fashion-1",
      });

      expect(artifact.files.map(({ path }) => path)).toEqual(["_nuxt/app.js", "index.html"]);
      expect(artifact.files[0]?.contentType).toBe("text/javascript; charset=utf-8");
      expect(JSON.parse(await readFile(manifestPath, "utf8"))).toMatchObject({
        schemaVersion: 1,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("serves only authorized exact-prefix objects with private security headers", async () => {
    const bucket = new MemoryBucket();
    const artifact = await uploadPreviewArtifact(bucket, "snapshot-fashion-1", previewFiles);
    const auth = {
      fetch: async () =>
        Response.json({
          artifactPrefix: artifact.prefix,
          authorized: true,
          expiresAt: "2026-07-30T02:00:00.000Z",
          origin: "https://preview.example.test",
        }),
    };
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T01:30:00.000Z"),
    });
    const response = await handler(
      new Request("https://preview.example.test/", {
        headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
      }),
      {
        PREVIEW_ARTIFACTS: bucket,
        PREVIEW_AUTH: auth,
        PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
        PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
        PREVIEW_ORIGIN: "https://preview.example.test",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<h1>Preview</h1>");
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://preview.example.test",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain("connect-src 'none'");
  });

  test("redeems a grant only through POST and sets a strict host-only session cookie", async () => {
    const grant = "grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const authRequests: Request[] = [];
    const handler = createPreviewAccessHandler();
    const environment = {
      PREVIEW_ARTIFACTS: new MemoryBucket(),
      PREVIEW_AUTH: {
        fetch: async (request: Request) => {
          authRequests.push(request);
          return Response.json({
            data: {
              expiresAt: "2099-07-30T02:00:00.000Z",
              session: "session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
            },
          });
        },
      },
      PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
      PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
      PREVIEW_ORIGIN: "https://preview.example.test",
    };
    const rejected = await handler(
      new Request("https://preview.example.test/__preview/session", {
        body: new URLSearchParams({ grant }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://attacker.example.test",
        },
        method: "POST",
      }),
      environment,
    );
    expect(rejected.status).toBe(403);
    expect(authRequests).toHaveLength(0);
    const response = await handler(
      new Request("https://preview.example.test/__preview/session", {
        body: new URLSearchParams({ grant }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://admin.example.test",
        },
        method: "POST",
      }),
      environment,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Location")).not.toContain(grant);
    expect(response.headers.get("Set-Cookie")).toContain(
      "__Host-shoppp-preview=session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    );
    expect(response.headers.get("Set-Cookie")).toContain("Path=/; Expires=");
    expect(response.headers.get("Set-Cookie")).toContain("Secure; HttpOnly; SameSite=Strict");
    expect(authRequests).toHaveLength(1);
    expect(authRequests[0]?.url).toBe("https://preview-auth.internal/internal/preview/redeem");
    expect(authRequests[0]?.headers.get("Authorization")).toBe(
      "Bearer preview-auth-token-000000000000000001",
    );
  });

  test("returns authorization or real 404 responses without crossing prefixes", async () => {
    const bucket = new MemoryBucket();
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T03:00:00.000Z"),
    });
    const environment = {
      PREVIEW_ARTIFACTS: bucket,
      PREVIEW_AUTH: {
        fetch: async () =>
          Response.json({
            artifactPrefix: `snapshots/snapshot-fashion-1/${"a".repeat(64)}`,
            authorized: true,
            expiresAt: "2026-07-30T02:00:00.000Z",
            origin: "https://preview.example.test",
          }),
      },
      PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
      PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
      PREVIEW_ORIGIN: "https://preview.example.test",
    };

    expect((await handler(new Request("https://preview.example.test/"), environment)).status).toBe(
      401,
    );
    expect(
      (
        await handler(
          new Request("https://preview.example.test/", {
            headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
          }),
          environment,
        )
      ).status,
    ).toBe(403);

    const unexpired = {
      ...environment,
      PREVIEW_AUTH: {
        fetch: async () =>
          Response.json({
            artifactPrefix: `snapshots/snapshot-fashion-1/${"a".repeat(64)}`,
            authorized: true,
            expiresAt: "2026-07-30T04:00:00.000Z",
            origin: "https://preview.example.test",
          }),
      },
    };
    expect(
      (
        await handler(
          new Request("https://preview.example.test/missing.html", {
            headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
          }),
          unexpired,
        )
      ).status,
    ).toBe(404);
  });
});

test("production Wrangler configuration has no preview binding or entrypoint", async () => {
  const configuration = await readFile(resolve(import.meta.dir, "../wrangler.jsonc"), "utf8");

  expect(configuration).not.toContain("PREVIEW_ARTIFACTS");
  expect(configuration).not.toContain("preview-access.ts");
});
