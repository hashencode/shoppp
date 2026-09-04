<script setup lang="ts">
import { computed } from "vue";
import { fashionStoreBrandIcons } from "../../icons/brands";
import { fashionStoreUiIcons, type FashionStoreIconName } from "../../icons/ui";

const properties = withDefaults(defineProps<{ name: FashionStoreIconName; filled?: boolean }>(), {
  filled: false,
});
const uiIcon = computed(
  () => fashionStoreUiIcons[properties.name as keyof typeof fashionStoreUiIcons],
);
const brandIcon = computed(
  () => fashionStoreBrandIcons[properties.name as keyof typeof fashionStoreBrandIcons],
);
</script>

<template>
  <i class="fashion-store-icon" :data-fashion-store-icon="name" aria-hidden="true">
    <component
      :is="uiIcon"
      v-if="uiIcon"
      width="1em"
      height="1em"
      :fill="filled ? 'currentColor' : 'none'"
      :stroke-width="2"
      aria-hidden="true"
      focusable="false"
    />
    <svg
      v-else-if="brandIcon"
      :viewBox="brandIcon.viewBox"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path :d="brandIcon.path" />
    </svg>
  </i>
</template>

<style scoped>
.fashion-store-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  line-height: 1;
  font-style: normal;
  vertical-align: -0.125em;
  flex-shrink: 0;
}
.fashion-store-icon > svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
