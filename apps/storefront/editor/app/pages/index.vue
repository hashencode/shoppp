<script setup lang="ts">
import {
  editorParentMessageSchema,
  isEditorMessageSource,
  themePackageSchema,
  type EditorParentMessage,
  type ThemePackage,
  type CatalogReleaseV3,
  type CanonicalCatalogRelease,
  type ExperienceSnapshot,
} from "@shoppp/contracts";
import Renderer from "~/theme-engine/renderer.vue";
import {
  composeEditorExperienceRoute,
  type ComposedExperienceRoute,
} from "~/theme-engine/composer";
import { resolveThemeRoute } from "~/theme-engine/routes";
import { storefrontPresentationShellKey } from "~/theme-engine/presentation-context";
import { liveCommerceModeKey } from "~/theme-engine/runtime-commerce";
import { createThemeAssetResolver } from "~/theme-engine/assets";
import { themeRegistry, themeRoutes, themeAssets } from "~/themes/fashion-store/successor/registry";
import type { PresentationProvider } from "~/theme-engine/providers";

type Context = {
  id: string;
  nonce: string;
  expiresAt: string;
  package: ThemePackage;
  draft: { presetId: string };
  release: CatalogReleaseV3 | CanonicalCatalogRelease;
  contact: ExperienceSnapshot["contact"];
};
const context = shallowRef<Context>();
const composition = shallowRef<ComposedExperienceRoute>();
const template = shallowRef<ThemePackage["presets"][number]["templates"][number]>();
const problem = ref("");
let current: Extract<EditorParentMessage, { kind: "update" }> | undefined;
let initialization = 0;
let previousSelection: string | undefined;
const resolveAsset = createThemeAssetResolver("fashion-store", themeAssets);
const provider = computed<PresentationProvider>(() => ({
  resolve: ({ instanceId }) => {
    const result = composition.value?.viewModels[instanceId];
    if (!result) throw new Error("The selected resource is unavailable in this preview.");
    return result;
  },
  resolveShell: () => {
    if (!composition.value?.shell) throw new Error("The store header is unavailable.");
    return composition.value.shell;
  },
}));
provide(
  storefrontPresentationShellKey,
  computed(() => composition.value?.shell),
);
provide(liveCommerceModeKey, false);

function reply(value: Record<string, unknown>) {
  window.parent.postMessage(
    { protocol: 1, sessionId: context.value?.id, nonce: context.value?.nonce, ...value },
    window.location.origin,
  );
}
async function receive(event: MessageEvent) {
  if (!isEditorMessageSource(event, window.location.origin, window.parent)) return;
  const parsed = editorParentMessageSchema.safeParse(event.data);
  if (!parsed.success) return;
  const message = parsed.data;
  if (message.kind === "initialize") {
    const generation = ++initialization;
    current = undefined;
    previousSelection = undefined;
    context.value = undefined;
    composition.value = undefined;
    try {
      const response = await fetch(
        `/api/admin/storefront-editor/sessions/${encodeURIComponent(message.sessionId)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) throw new Error("Reconnect the editor preview to continue.");
      const result = (await response.json()).data as Context;
      if (
        generation !== initialization ||
        result.id !== message.sessionId ||
        result.nonce !== message.nonce
      )
        return;
      context.value = result;
      problem.value = "";
      reply({ kind: "applied", revision: 0 });
    } catch (error) {
      if (generation !== initialization) return;
      window.parent.postMessage(
        {
          protocol: 1,
          sessionId: message.sessionId,
          nonce: message.nonce,
          kind: "error",
          revision: 0,
          message: error instanceof Error ? error.message : "Preview unavailable",
        },
        window.location.origin,
      );
    }
    return;
  }
  const authorized = context.value;
  if (
    !authorized ||
    message.sessionId !== authorized.id ||
    message.nonce !== authorized.nonce ||
    message.revision < (current?.revision ?? 0)
  )
    return;
  try {
    if (Date.parse(authorized.expiresAt) <= Date.now())
      throw new Error("Reconnect the expired editor preview.");
    const preset = authorized.package.presets.find(({ id }) => id === authorized.draft.presetId);
    if (!preset) throw new Error("The selected preset is unavailable.");
    themePackageSchema.parse({
      ...authorized.package,
      presets: [{ ...preset, templates: message.document.templates }],
    });
    const route = resolveThemeRoute(message.path, themeRoutes, authorized.release, "live");
    const selected = message.document.templates.find(({ id }) => id === message.templateId);
    if (!route || !selected || route.pageType !== selected.pageType)
      throw new Error("Choose a published resource for this page.");
    const result = composeEditorExperienceRoute({
      experience: {
        bindings: message.document.bindings,
        resolvedTemplates: message.document.templates,
        themeId: authorized.package.manifest.id,
        themeVersion: authorized.package.manifest.themeVersion,
        configurationSchemaVersion: authorized.package.manifest.configurationSchemaVersion,
        contact: authorized.contact,
      },
      release: authorized.release,
      route,
      path: message.path,
      locale: "en",
      adapter: themeRegistry.composition,
      sectionComposition: themeRegistry.sectionComposition,
    });
    if (!result.ok) throw new Error(result.diagnostics.map(({ message }) => message).join(" "));
    current = message;
    template.value = selected;
    composition.value = result;
    problem.value = "";
    await nextTick();
    document
      .querySelectorAll("[data-editor-selected]")
      .forEach((node) => node.removeAttribute("data-editor-selected"));
    if (message.mode === "inspect" && message.selectedId) {
      const target = document.querySelector(
        `[data-editor-instance="${CSS.escape(message.selectedId)}"]`,
      );
      target?.setAttribute("data-editor-selected", "true");
      if (message.selectedId !== previousSelection) (target?.classList.contains('storefront-editor-region') ? target.firstElementChild : target)?.scrollIntoView({ block: "nearest" });
      previousSelection = message.selectedId;
    }
    reply({ kind: "applied", revision: message.revision });
  } catch (error) {
    problem.value = error instanceof Error ? error.message : "Preview unavailable";
    reply({ kind: "error", revision: message.revision, message: problem.value.slice(0, 2000) });
  }
}
function click(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !current) return;
  if (current.mode === "inspect") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const instanceId =
      target.closest<HTMLElement>("[data-editor-instance]")?.dataset.editorInstance;
    if (instanceId) reply({ kind: "select", revision: current.revision, instanceId });
    return;
  }
  const anchor = target.closest("a");
  if (anchor) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const url = new URL(anchor.href, window.location.origin);
    if (
      url.origin === window.location.origin &&
      resolveThemeRoute(url.pathname, themeRoutes, context.value?.release, "live")
    )
      reply({ kind: "navigate", revision: current.revision, path: url.pathname });
  }
}
function preventSubmit(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  window.addEventListener("message", receive);
  document.addEventListener("click", click, true);
  document.addEventListener("submit", preventSubmit, true);
  window.parent.postMessage({ kind: "ready", protocol: 1 }, window.location.origin);
  timer = setInterval(async () => {
    if (!context.value) return;
    const identity = context.value;
    try {
      const response = await fetch(`/api/admin/storefront-editor/sessions/${identity.id}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Reconnect the editor preview. Your changes are retained.");
    } catch {
      if (context.value !== identity) return;
      reply({
        kind: "error",
        revision: current?.revision ?? 0,
        message: "Reconnect the editor preview. Your changes are retained.",
      });
      context.value = undefined;
      composition.value = undefined;
    }
  }, 30_000);
});
onBeforeUnmount(() => {
  initialization++;
  clearInterval(timer);
  window.removeEventListener("message", receive);
  document.removeEventListener("click", click, true);
  document.removeEventListener("submit", preventSubmit, true);
});
</script>

<template>
  <div v-if="problem" class="editor-error">{{ problem }}</div>
  <div v-if="template && composition" :data-editor-mode="current?.mode">
    <Renderer
      :template="template"
      :registry="themeRegistry"
      :provider="provider"
      :resolve-asset="resolveAsset"
      editor
    />
  </div>
  <p v-else class="editor-waiting">Connect a published source to preview your design.</p>
</template>

<style>
.editor-error {
  position: sticky;
  top: 0;
  z-index: 100000;
  padding: 12px;
  background: #fff3cd;
  color: #664d03;
}
.editor-waiting {
  padding: 32px;
  font: 16px system-ui;
}
.storefront-editor-region[data-editor-selected] > * { outline: 2px solid #4f46e5; outline-offset: -2px; }
[data-editor-mode="inspect"] [data-editor-instance]:hover,
[data-editor-mode="inspect"] [data-editor-selected] {
  outline: 2px solid #4f46e5;
  outline-offset: -2px;
}
</style>
