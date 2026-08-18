<script setup lang="ts">
import type { StorefrontShippingAddress } from "../../theme-engine/cart-state";

type Address = StorefrontShippingAddress;

withDefaults(defineProps<{ disabled?: boolean; showLegend?: boolean }>(), {
  disabled: false,
  showLegend: true,
});
const model = defineModel<Address>({ required: true });
</script>

<template>
  <fieldset class="address-fields" :disabled="disabled">
    <legend v-if="showLegend">Shipping address</legend>
    <label>Name <input v-model="model.name" required autocomplete="name" /></label>
    <label
      >Address <input v-model="model.line1" required autocomplete="shipping address-line1"
    /></label>
    <label
      >City <input v-model="model.city" required autocomplete="shipping address-level2"
    /></label>
    <label>Region <input v-model="model.region" autocomplete="shipping address-level1" /></label>
    <label>
      Postal code
      <input v-model="model.postalCode" required autocomplete="shipping postal-code" />
    </label>
    <label>
      Country
      <select v-model="model.countryCode" autocomplete="shipping country">
        <option value="US">United States</option>
      </select>
    </label>
  </fieldset>
</template>
