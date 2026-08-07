<script setup lang="ts">
export interface FashionStoreAccordionItem {
  body: string;
  title: string;
}

const properties = withDefaults(
  defineProps<{
    idPrefix: string;
    items: readonly FashionStoreAccordionItem[];
    modelValue?: number | null;
    titleClass?: string;
  }>(),
  { modelValue: 0, titleClass: "fw-600 fs-19" },
);
const emit = defineEmits<{ "update:modelValue": [value: number | null] }>();

function toggle(index: number): void {
  emit("update:modelValue", properties.modelValue === index ? null : index);
}
</script>

<template>
  <div class="accordion accordion-style-02">
    <div
      v-for="(item, index) in items"
      :key="item.title"
      class="accordion-item"
      :class="{ 'active-accordion': modelValue === index }"
    >
      <div class="accordion-header border-bottom border-color-extra-medium-gray">
        <button
          :id="`${idPrefix}-trigger-${index}`"
          type="button"
          class="fashion-accordion-trigger"
          :aria-controls="`${idPrefix}-panel-${index}`"
          :aria-expanded="modelValue === index"
          @click="toggle(index)"
        >
          <span class="accordion-title mb-0 position-relative text-dark-gray">
            <i
              class="feather"
              :class="modelValue === index ? 'icon-feather-minus' : 'icon-feather-plus'"
            ></i>
            <span :class="titleClass">{{ item.title }}</span>
          </span>
        </button>
      </div>
      <div
        v-show="modelValue === index"
        :id="`${idPrefix}-panel-${index}`"
        class="accordion-collapse collapse show"
        role="region"
        :aria-labelledby="`${idPrefix}-trigger-${index}`"
      >
        <div
          class="accordion-body last-paragraph-no-margin border-bottom border-color-light-medium-gray"
        >
          <p>{{ item.body }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
