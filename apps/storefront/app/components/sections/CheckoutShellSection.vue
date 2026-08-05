<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <main v-if="viewModel.kind === 'checkout'" class="commerce-shell checkout-grid">
    <section>
      <h1>{{ viewModel.heading }}</h1>
      <ol>
        <li v-for="step in viewModel.steps" :key="step">{{ step }}</li>
      </ol>
      <p v-if="viewModel.errorMessage" class="form-error" role="alert">
        {{ viewModel.errorMessage }}
      </p>
      <button
        class="buy-button"
        type="button"
        @click="recordPreviewIntent(viewModel.action, 'core.checkout')"
      >
        {{ viewModel.action.label }}
      </button>
    </section>
    <aside aria-label="Fixture order summary">
      <h2>Summary</h2>
      <ul>
        <li v-for="line in viewModel.summaryLines" :key="line">{{ line }}</li>
      </ul>
    </aside>
    <slot />
  </main>
</template>
