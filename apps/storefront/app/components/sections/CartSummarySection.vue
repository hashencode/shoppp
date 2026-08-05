<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <main v-if="viewModel.kind === 'cart'" class="commerce-shell">
    <h1>{{ viewModel.heading }}</h1>
    <p v-if="viewModel.state === 'validation-error'" class="form-error" role="alert">
      The fixture cart configuration needs attention.
    </p>
    <ul class="cart-lines">
      <li v-for="line in viewModel.lines" :key="line.id">
        <p class="cart-item-title">{{ line.name }}</p>
        <span>{{ line.priceLabel }}</span>
        <span>Quantity {{ line.quantity }}</span>
        <button
          v-for="action in line.quantityActions"
          :key="action.id"
          type="button"
          @click="recordPreviewIntent(action, 'core.cart')"
        >
          {{ action.label }}
        </button>
      </li>
    </ul>
    <p class="price">{{ viewModel.subtotalLabel }}</p>
    <button
      class="buy-button"
      type="button"
      @click="recordPreviewIntent(viewModel.checkoutAction, 'core.cart')"
    >
      {{ viewModel.checkoutAction.label }}
    </button>
    <slot />
  </main>
</template>
