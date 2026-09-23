<script setup lang="ts">
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreShell from "../shared/FashionStoreShell.vue";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";

defineProps<{
  presentation: Extract<PresentationViewModel, { kind: "released-content" }>;
  resolveAsset: ThemeAssetResolver;
}>();
</script>

<template>
  <FashionStoreShell :resolve-asset="resolveAsset" :show-sticky-socials="false">
    <main id="fashion-store-main" class="released-content" data-fashion-store-released-content>
      <article>
        <header class="released-content__header">
          <p v-if="presentation.contentKind === 'article'" class="released-content__eyebrow">
            Article
          </p>
          <h1>{{ presentation.title }}</h1>
          <p v-if="presentation.summary" class="released-content__summary">
            {{ presentation.summary }}
          </p>
        </header>
        <div class="released-content__body">
          <template v-for="section in presentation.sections" :key="section.id">
            <h2 v-if="section.kind === 'heading' && section.level === 2">{{ section.text }}</h2>
            <h3 v-else-if="section.kind === 'heading'">{{ section.text }}</h3>
            <p v-else-if="section.kind === 'paragraph'">{{ section.text }}</p>
            <figure v-else-if="section.kind === 'image'">
              <img
                :alt="section.alt"
                :height="section.media.height"
                :src="section.media.src"
                :width="section.media.width"
              />
              <figcaption v-if="section.caption">{{ section.caption }}</figcaption>
            </figure>
            <p v-else>
              <a
                :href="section.href"
                :rel="section.targetBehavior === 'new-window' ? 'noopener noreferrer' : undefined"
                :target="section.targetBehavior === 'new-window' ? '_blank' : undefined"
              >
                {{ section.label }}
              </a>
            </p>
          </template>
        </div>
      </article>
    </main>
  </FashionStoreShell>
</template>

<style scoped>
.released-content {
  margin: 0 auto;
  max-width: 920px;
  padding: clamp(3rem, 8vw, 7rem) 1.5rem;
}
.released-content__header,
.released-content__body {
  display: grid;
  gap: 1.25rem;
}
.released-content__header {
  margin-bottom: 3rem;
}
.released-content__header h1 {
  font-size: clamp(2.5rem, 6vw, 5rem);
  line-height: 1;
}
.released-content__eyebrow {
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.released-content__summary {
  font-size: 1.2rem;
  max-width: 65ch;
}
.released-content__body p {
  line-height: 1.75;
  white-space: pre-wrap;
}
.released-content__body img {
  display: block;
  height: auto;
  max-width: 100%;
}
</style>
