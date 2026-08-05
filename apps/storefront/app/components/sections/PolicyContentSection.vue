<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <main v-if="viewModel.kind === 'policy'" class="section">
    <article class="prose">
      <h1>{{ viewModel.heading }}</h1>
      <p v-for="paragraph in viewModel.paragraphs" :key="paragraph">{{ paragraph }}</p>
    </article>
    <slot />
  </main>
</template>
