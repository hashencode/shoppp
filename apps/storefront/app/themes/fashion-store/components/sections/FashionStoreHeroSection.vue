<script setup lang="ts">
import FashionStoreDecorHero from "../FashionStoreDecorHero.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import {
  isLiveHomeViewModel,
  resolveLiveHomeData,
} from "./home-section-context";
import { resolveFashionStoreBlockReferenceHref } from "../../contracts/block-destinations";
import { fashionStoreAssetId } from "../../resources";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const slides = computed(() =>
  properties.instance.blocks
    .filter(({ visible, type }) => visible && type === "fashion-store.hero-slide")
    .map((block) => {
      const asset = (settingId: string) => {
        const value = block.settings[settingId];
        return typeof value === "object" && value !== null && "kind" in value && value.kind === "theme"
          ? fashionStoreAssetId(value.path)
          : "";
      };
      const live = isLiveHomeViewModel(properties.viewModel)
        ? resolveLiveHomeData(properties.viewModel)
        : null;
      const backgroundColors: Record<string, string> = {
        aqua: "#e9fafb",
        mist: "#e5eff3",
        peach: "#f7eee3",
      };
      const foregroundColors: Record<string, string> = {
        black: "#111111",
        ink: "#232323",
        white: "#ffffff",
      };
      return {
        background: backgroundColors[String(block.settings["background-color"])] ?? "#e5eff3",
        foreground: foregroundColors[String(block.settings["foreground-color"])] ?? "#232323",
        href:
          resolveFashionStoreBlockReferenceHref(live, block, "destination", "collection") ?? "",
        id: block.id,
        patternDesktop: asset("pattern-desktop"),
        patternMobile: asset("pattern-mobile"),
        price: typeof block.settings.price === "string" ? block.settings.price : "",
        product: asset("product-image"),
        thumb: asset("thumbnail"),
        title: typeof block.settings.title === "string" ? block.settings.title : "",
      };
    }),
);
</script>

<template>
  <section class="p-0" data-home-section="hero">
    <FashionStoreDecorHero :resolve-asset="properties.resolveAsset" :slides="slides" />
  </section>
</template>
