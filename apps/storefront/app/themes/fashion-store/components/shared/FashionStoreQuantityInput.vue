<script setup lang="ts">
const properties = defineProps<{
  decrementLabel?: string;
  disabled?: boolean;
  id?: string;
  incrementLabel?: string;
  label: string;
  max: number;
  min: number;
  modelValue: number;
  variant: "product" | "cart" | "plain";
}>();
const emit = defineEmits<{ commit: [value: number] }>();

function commit(value: number): void {
  if (properties.disabled) return;
  const normalized = Math.min(
    properties.max,
    Math.max(properties.min, Math.floor(Number.isFinite(value) ? value : properties.min)),
  );
  if (normalized !== properties.modelValue) emit("commit", normalized);
}

function change(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  // The parent owns the committed value, including rejected asynchronous changes.
  input.value = String(properties.modelValue);
  commit(value);
}
</script>

<template>
  <input
    v-if="variant === 'plain'"
    :id="id"
    class="input-small"
    type="number"
    :min="min"
    :max="max"
    :value="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @change="change"
  />
  <div v-else class="quantity">
    <button
      type="button"
      class="qty-minus"
      :aria-label="decrementLabel"
      :disabled="disabled || (variant === 'cart' && modelValue <= min)"
      @click="commit(modelValue - 1)"
    >
      -
    </button>
    <input
      :id="id"
      class="qty-text"
      :type="variant === 'product' ? 'text' : 'number'"
      :inputmode="variant === 'product' ? 'numeric' : undefined"
      :min="variant === 'cart' ? min : undefined"
      :max="variant === 'cart' ? max : undefined"
      :role="variant === 'product' ? 'spinbutton' : undefined"
      :aria-valuemin="variant === 'product' ? min : undefined"
      :aria-valuemax="variant === 'product' ? max : undefined"
      :aria-valuenow="variant === 'product' ? modelValue : undefined"
      :value="modelValue"
      :aria-label="label"
      :disabled="disabled"
      @change="change"
    />
    <button
      type="button"
      class="qty-plus"
      :aria-label="incrementLabel"
      :disabled="disabled"
      @click="commit(modelValue + 1)"
    >
      +
    </button>
  </div>
</template>
