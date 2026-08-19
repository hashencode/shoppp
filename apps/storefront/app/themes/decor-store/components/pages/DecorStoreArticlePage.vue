<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreArticleData } from "../../fixtures/pages/content";
import DecorStoreShell from "../shared/DecorStoreShell.vue";
defineProps<{ resolveAsset: ThemeAssetResolver }>();
</script>
<template>
  <DecorStoreShell
    active-page="article"
    :announcement="decorStoreArticleData.announcement"
    :resolve-asset="resolveAsset"
    ><article class="pt-100px pb-100px">
      <div class="container">
        <p>Writer by {{ decorStoreArticleData.author }} in {{ decorStoreArticleData.category }}</p>
        <h1 class="alt-font text-dark-gray fw-700">{{ decorStoreArticleData.title }}.</h1>
        <p v-for="paragraph in decorStoreArticleData.paragraphs" :key="paragraph">
          {{ paragraph }}
        </p>
        <blockquote>We must never confuse elegance with snobbery</blockquote>
      </div>
    </article></DecorStoreShell
  >
</template>
