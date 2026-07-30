<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <footer v-if="viewModel.kind === 'footer'" class="site-footer">
    <div>
      <p class="wordmark">{{ viewModel.brand }}</p>
      <p>{{ viewModel.summary }}</p>
    </div>
    <nav aria-label="Legal">
      <NuxtLink
        v-for="link in viewModel.legalLinks"
        :key="link.id"
        :to="link.target"
        @click="recordPreviewIntent(link, 'core.footer')"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>
    <slot />
  </footer>
</template>
