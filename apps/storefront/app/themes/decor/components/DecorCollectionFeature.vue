<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import {
  createInteractionController,
  type InteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useDecorRevealMotion } from "../composables/useDecorRevealMotion";

interface Data {
  backgroundAssetId: string;
  bannerAssetId: string;
  heading: string;
  products: {
    assetId: string;
    comparePrice: string;
    name: string;
    price: string;
  }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const snapshot = ref<InteractionSnapshot>({
  currentIndex: 0,
  direction: 0,
  pausedReasons: [],
  phase: "idle",
  targetIndex: 0,
  transitionStartedAt: null,
});
const visibleIndex = computed(() =>
  snapshot.value.phase === "transitioning"
    ? snapshot.value.targetIndex
    : snapshot.value.currentIndex,
);
const revealRoot = useDecorRevealMotion(["collection-banner", "collection-product"]);
const controllerReady = ref(false);
let controller: InteractionController | undefined;
let unsubscribe: (() => void) | undefined;
let reducedMotionQuery: MediaQueryList | undefined;
let pointerStart: { id: number; x: number; y: number } | undefined;

function stateFor(index: number): "active" | "entering" | "exiting" | "inactive" {
  if (snapshot.value.phase === "transitioning") {
    if (index === snapshot.value.targetIndex) return "entering";
    if (index === snapshot.value.currentIndex) return "exiting";
  }
  return index === snapshot.value.currentIndex ? "active" : "inactive";
}
function handleKey(event: KeyboardEvent): void {
  if (!controller?.handleKey(event.key)) return;
  event.preventDefault();
}
function pointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea"))
    return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.setPointerCapture(event.pointerId);
}
function pointerUp(event: PointerEvent): void {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  controller?.handleSwipe({
    axis: "horizontal",
    deltaX: event.clientX - pointerStart.x,
    deltaY: event.clientY - pointerStart.y,
    threshold: 50,
  });
  pointerStart = undefined;
}
function pointerCancel(event: PointerEvent): void {
  if (pointerStart?.id === event.pointerId) pointerStart = undefined;
}
function visibilityChanged(): void {
  if (document.hidden) controller?.pause("document-hidden");
  else controller?.resume("document-hidden");
}
function reducedMotionChanged(): void {
  if (reducedMotionQuery?.matches) controller?.pause("reduced-motion");
  else controller?.resume("reduced-motion");
}
onMounted(() => {
  controller = createInteractionController({
    autoplayDelayMs: 3_000,
    count: data.value?.products.length ?? 0,
    transitionDurationMs: 300,
  });
  unsubscribe = controller.subscribe((nextSnapshot) => {
    snapshot.value = nextSnapshot;
  });
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionChanged();
  if (document.hidden) controller.pause("document-hidden");
  reducedMotionQuery.addEventListener("change", reducedMotionChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  controller.start();
  controllerReady.value = true;
});
onBeforeUnmount(() => {
  unsubscribe?.();
  controller?.dispose();
  reducedMotionQuery?.removeEventListener("change", reducedMotionChanged);
  document.removeEventListener("visibilitychange", visibilityChanged);
});
</script>
<template>
  <section
    v-if="data"
    ref="revealRoot"
    class="decor-collection"
    tabindex="0"
    aria-roledescription="carousel"
    aria-label="Lounge collection"
    data-motion-autoplay-ms="3000"
    data-motion-direction="horizontal"
    data-motion-duration-ms="300"
    data-motion-easing="ease-in-out"
    :data-motion-ready="controllerReady ? 'true' : 'false'"
    :data-motion-active-index="visibleIndex"
    :data-motion-paused="snapshot.pausedReasons.join(',')"
    :data-motion-phase="snapshot.phase"
    :data-current-index="snapshot.currentIndex"
    :data-target-index="snapshot.targetIndex"
    data-source-reveal="collection"
    data-reveal-state="pending"
    @keydown="handleKey"
    @pointerdown="pointerDown"
    @pointerup="pointerUp"
    @pointercancel="pointerCancel"
  >
    <div class="decor-collection-banner" data-reveal-group="collection-banner" data-reveal-item>
      <img
        :src="p.resolveAsset(data.bannerAssetId)"
        alt="Blue lounge interior"
        width="1200"
        height="900"
        loading="lazy"
      />
      <div>
        <small>Save up to 50% off</small>
        <h2>Lounge <strong>collection</strong></h2>
        <a href="/#decor-products"
          ><span class="decor-collection-cta-label">Explore category</span></a
        >
      </div>
    </div>
    <div
      class="decor-collection-product"
      data-reveal-group="collection-product"
      data-reveal-item
      :style="{ backgroundImage: `url(${p.resolveAsset(data.backgroundAssetId)})` }"
    >
      <article
        v-for="(product, index) in data.products"
        :key="product.assetId"
        :aria-hidden="stateFor(index) === 'inactive' || stateFor(index) === 'exiting'"
        :data-state="stateFor(index)"
        :inert="stateFor(index) === 'inactive' || stateFor(index) === 'exiting'"
      >
        <img
          :src="p.resolveAsset(product.assetId)"
          :alt="product.name"
          width="700"
          height="700"
          loading="lazy"
        />
        <h3>
          <span>{{ product.name }}</span>
        </h3>
        <p>
          <span class="decor-collection-price"
            ><del>{{ product.comparePrice }}</del
            >{{ product.price }}</span
          >
        </p>
      </article>
      <div>
        <button type="button" aria-label="Previous product" @click="controller?.previous()">
          <i class="decor-bootstrap-icon decor-bootstrap-arrow-left" aria-hidden="true"></i></button
        ><span>{{ visibleIndex + 1 }} / {{ data.products.length }}</span
        ><button type="button" aria-label="Next product" @click="controller?.next()">
          <i class="decor-bootstrap-icon decor-bootstrap-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </section>
</template>
