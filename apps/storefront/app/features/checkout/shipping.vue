<script setup lang="ts">
import type { ShippingMethodQuote } from "@shoppp/contracts";

defineProps<{ currency: string; methods: ShippingMethodQuote[] }>();
const model = defineModel<string | undefined>();
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);
</script>

<template>
  <fieldset v-if="methods.length" class="shipping-methods">
    <legend>Shipping method</legend>
    <label v-for="method in methods" :key="method.id">
      <input v-model="model" type="radio" name="shipping-method" :value="method.id" />
      <span>{{ method.name }}</span>
      <strong>{{ money(method.amount, currency) }}</strong>
    </label>
  </fieldset>
</template>
