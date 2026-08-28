<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { normalizeThemeRoutePath } from "../../../../theme-engine/routes";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { resolveDecorStorePage, type DecorStorePageId } from "../../page-contracts";
import DecorStoreSourceReplicaPage from "./DecorStoreSourceReplicaPage.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const router = useRouter();
const pageId = computed<Exclude<DecorStorePageId, "home">>(() => {
  const path = normalizeThemeRoutePath(router.currentRoute.value.path);
  const resolved = resolveDecorStorePage(path, { includeDisabled: true });
  if (!resolved || resolved.id === "home")
    throw new Error(`Unknown Decor Store secondary route: ${path}`);
  return resolved.id as Exclude<DecorStorePageId, "home">;
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
  <DecorStoreSourceReplicaPage
    :page-id="pageId"
    :announcement="announcement"
    :resolve-asset="resolveAsset"
  />
</template>
