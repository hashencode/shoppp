<script setup lang="ts">
import { fashionStoreHomeMarquee as marquee } from "./home-content";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";
import { useFashionStoreMotionViewport } from "../../composables/useFashionStoreMotionViewport";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));
const root = ref<HTMLElement>();
const viewportVisible = useFashionStoreMotionViewport(root);
const documentHidden = ref(false);
const reducedMotion = ref(false);
let reducedMotionQuery: MediaQueryList | undefined;
const motionPauseReason = computed(() =>
  [
    viewportVisible.value ? "" : "viewport-hidden",
    documentHidden.value ? "document-hidden" : "",
    reducedMotion.value ? "reduced-motion" : "",
  ]
    .filter(Boolean)
    .join(","),
);

function updateMotionPauseReasons(): void {
  documentHidden.value = document.hidden;
  reducedMotion.value = reducedMotionQuery?.matches === true;
}

onMounted(() => {
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionQuery.addEventListener("change", updateMotionPauseReasons);
  document.addEventListener("visibilitychange", updateMotionPauseReasons);
  updateMotionPauseReasons();
});

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener("change", updateMotionPauseReasons);
  document.removeEventListener("visibilitychange", updateMotionPauseReasons);
});
</script>

<template>
  <section
    ref="root"
    data-home-section="marquee"
    :data-presentation-variant="presentation.marquee"
    class="p-0 border-top border-bottom border-color-extra-medium-gray overflow-hidden"
  >
    <div
      class="d-flex flex-nowrap py-25px"
      aria-label="Fashion highlights"
      data-fashion-store-marquee
      :data-motion-paused="motionPauseReason"
    >
      <span
        v-for="(message, index) in marquee"
        :key="`${message}-${index}`"
        class="alt-font text-uppercase fw-600 fs-18 me-50px swiper-slide text-dark-gray"
        >{{ message }}</span
      >
    </div>
  </section>
</template>
