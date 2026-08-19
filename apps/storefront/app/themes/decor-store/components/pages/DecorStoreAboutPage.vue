<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreAboutData } from "../../fixtures/pages/content";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";
defineProps<{ resolveAsset: ThemeAssetResolver }>();
const slide = ref(0);
function move(delta: number): void {
  slide.value =
    (slide.value + delta + decorStoreAboutData.slides.length) % decorStoreAboutData.slides.length;
}
</script>
<template>
  <DecorStoreShell
    active-page="about"
    :announcement="decorStoreAboutData.announcement"
    :resolve-asset="resolveAsset"
    ><DecorStorePageTitle breadcrumb="about us" title="About us" />
    <section class="pb-80px">
      <div class="container">
        <p>Decor store story</p>
        <h2>Commitment to quality product.</h2>
        <div role="region" aria-label="About story carousel">
          <button type="button" aria-label="Previous story" @click="move(-1)">Previous</button>
          <p role="status">{{ decorStoreAboutData.slides[slide] }}</p>
          <button type="button" aria-label="Next story" @click="move(1)">Next</button>
        </div>
        <ol>
          <li v-for="milestone in decorStoreAboutData.milestones" :key="milestone">
            {{ milestone }}
          </li>
        </ol>
      </div>
    </section></DecorStoreShell
  >
</template>
