<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { normalizeThemeRoutePath } from "../../../../theme-engine/routes";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { resolveDecorStorePage } from "../../page-contracts";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const router = useRouter();
const page = computed(() => {
  const path = normalizeThemeRoutePath(router.currentRoute.value.path);
  const resolved = resolveDecorStorePage(path, { includeDisabled: true });
  if (!resolved || resolved.id === "home")
    throw new Error(`Unknown Decor Store secondary route: ${path}`);
  return resolved;
});
const data = computed(() =>
  properties.viewModel.kind === "theme-section" ? properties.viewModel.data : {},
);
const announcement = computed(() =>
  typeof data.value.announcement === "string"
    ? data.value.announcement
    : "Free Delivery on orders over £120. Don't miss discount.",
);
</script>

<template>
  <DecorStoreShell
    :active-page="page.id"
    :announcement="announcement"
    :resolve-asset="resolveAsset"
  >
    <section class="page-title-center-alignment cover-background top-space-padding">
      <div class="container">
        <div class="row">
          <div class="col-12 text-center position-relative page-title-extra-large">
            <h1 class="alt-font d-inline-block fw-700 text-base-color mb-10px">{{ page.id }}</h1>
          </div>
        </div>
      </div>
    </section>
    <section data-decor-secondary-shell-probe class="pt-80px pb-80px">
      <div class="container"><slot /></div>
    </section>
  </DecorStoreShell>
</template>
