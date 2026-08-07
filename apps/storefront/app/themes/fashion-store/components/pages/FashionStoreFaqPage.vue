<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import FashionStoreAccordion from "../shared/FashionStoreAccordion.vue";
import FashionStorePageTitle from "../shared/FashionStorePageTitle.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store FAQ requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreContentData).faq;
});
const activeCategory = ref(0);
const activeQuestion = ref<number | null>(0);

function selectCategory(index: number): void {
  activeCategory.value = index;
  activeQuestion.value = 0;
}

function moveCategory(event: KeyboardEvent, step: number): void {
  const buttons = Array.from(
    (event.currentTarget as HTMLElement)
      .closest('[role="tablist"]')!
      .querySelectorAll<HTMLElement>('[role="tab"]'),
  );
  const next = (activeCategory.value + step + buttons.length) % buttons.length;
  selectCategory(next);
  nextTick(() => buttons[next]?.focus());
}
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-faq
      data-runtime-status="ready"
      :data-active-category="activeCategory"
      :data-active-question="activeQuestion ?? 'closed'"
    >
      <FashionStorePageTitle title="FAQs" />
      <section class="pt-0 fashion-faq-content">
        <div class="container">
          <div class="row">
            <div class="col-xl-3 col-lg-4 tab-style-07 md-mb-20px">
              <div
                class="nav nav-tabs justify-content-center border-0 text-start alt-font fw-500"
                role="tablist"
                aria-label="FAQ categories"
              >
                <button
                  v-for="(category, index) in data.categories"
                  :id="`fashion-faq-tab-${index}`"
                  :key="category.label"
                  type="button"
                  class="nav-link fs-18"
                  :class="{ active: activeCategory === index }"
                  role="tab"
                  :aria-controls="`fashion-faq-panel-${index}`"
                  :aria-selected="activeCategory === index"
                  :tabindex="activeCategory === index ? 0 : -1"
                  @click="selectCategory(index)"
                  @keydown.left.prevent="moveCategory($event, -1)"
                  @keydown.right.prevent="moveCategory($event, 1)"
                >
                  <span>{{ category.label }}</span
                  ><span class="bg-hover bg-base-color"></span>
                </button>
              </div>
            </div>
            <div class="col-lg-8 offset-xl-1 lg-ps-50px md-ps-15px">
              <div
                :id="`fashion-faq-panel-${activeCategory}`"
                class="tab-content h-100"
                role="tabpanel"
                :aria-labelledby="`fashion-faq-tab-${activeCategory}`"
              >
                <FashionStoreAccordion
                  v-model="activeQuestion"
                  :id-prefix="`fashion-faq-${activeCategory}`"
                  :items="data.categories[activeCategory]!.questions"
                  title-class="fw-500 fs-18"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
