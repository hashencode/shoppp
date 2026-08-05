<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import {
  createInteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface CollectionData {
  body: string;
  eyebrow: string;
  heading: string;
  items: { assetId: string; name: string; tagline: string }[];
  options?: {
    autoplayMs: number;
    disableOnInteraction: false;
    keyboard: boolean;
    speedMs: number;
    touch: boolean;
  };
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as CollectionData)
    : null,
);
const rail = useTemplateRef<HTMLDivElement>("rail");
const uniqueCount = computed(
  () => new Set(data.value?.items.map(({ assetId }) => assetId) ?? []).size,
);
const controller = createInteractionController({
  autoplayDelayMs: data.value?.options?.autoplayMs ?? 4_000,
  count: uniqueCount.value,
  transitionDurationMs: data.value?.options?.speedMs ?? 300,
});
const motion = shallowRef<InteractionSnapshot>(controller.snapshot());
const visibleIndex = computed(() =>
  motion.value.phase === "transitioning" ? motion.value.targetIndex : motion.value.currentIndex,
);
const physicalIndex = ref(0);
const ready = ref(false);
const transitionEnabled = ref(true);
const translateX = ref(0);
let unsubscribe: () => void = () => undefined;
let reducedMotionQuery: MediaQueryList | undefined;
let pointerStart: { id: number; x: number; y: number } | null = null;
let previousPhase: InteractionSnapshot["phase"] = "idle";
let transitionResetFrame = 0;
let unmounted = false;

function visibleCount(): number {
  if (innerWidth >= 1_400) return 4;
  if (innerWidth >= 768) return 3;
  if (innerWidth >= 576) return 2;
  return 1;
}

function updateTranslation(): void {
  if (!rail.value) return;
  const count = visibleCount();
  const gap = 30;
  const cardWidth = (rail.value.clientWidth - gap * (count - 1)) / count;
  translateX.value = -physicalIndex.value * (cardWidth + gap);
}

function settlePhysicalIndex(snapshot: InteractionSnapshot): void {
  if (previousPhase !== "transitioning" || snapshot.phase !== "idle") return;
  if (physicalIndex.value < uniqueCount.value) return;
  transitionEnabled.value = false;
  physicalIndex.value = snapshot.currentIndex;
  updateTranslation();
  cancelAnimationFrame(transitionResetFrame);
  transitionResetFrame = requestAnimationFrame(() => {
    if (!unmounted) transitionEnabled.value = true;
  });
}

function receiveSnapshot(snapshot: InteractionSnapshot): void {
  settlePhysicalIndex(snapshot);
  if (snapshot.phase === "transitioning" && previousPhase === "idle") {
    const count = uniqueCount.value;
    const forward = (snapshot.targetIndex - snapshot.currentIndex + count) % count;
    const backward = (snapshot.currentIndex - snapshot.targetIndex + count) % count;
    const distance = snapshot.direction === 1 ? forward : backward;
    physicalIndex.value += snapshot.direction * distance;
    updateTranslation();
  }
  previousPhase = snapshot.phase;
  motion.value = snapshot;
}

function next(): void {
  controller.next();
}

async function previous(): Promise<void> {
  if (motion.value.phase !== "idle") return;
  if (motion.value.currentIndex === 0) {
    transitionEnabled.value = false;
    physicalIndex.value = uniqueCount.value;
    updateTranslation();
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (unmounted) return;
    transitionEnabled.value = true;
  }
  controller.previous();
}

function keydown(event: KeyboardEvent): void {
  if (!data.value?.options?.keyboard) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    void previous();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    next();
  }
}

function pointerDown(event: PointerEvent): void {
  if (!data.value?.options?.touch || event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea"))
    return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.setPointerCapture(event.pointerId);
}

function pointerUp(event: PointerEvent): void {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
  if (deltaX < 0) next();
  else void previous();
}

function visibilityChanged(): void {
  if (document.hidden) controller.pause("document-hidden");
  else controller.resume("document-hidden");
}

function reducedMotionChanged(): void {
  if (reducedMotionQuery?.matches) controller.pause("reduced-motion");
  else controller.resume("reduced-motion");
}

function headingLead(heading: string): string {
  return heading.split(" ").slice(0, -1).join(" ");
}

function headingHighlight(heading: string): string {
  return heading.split(" ").at(-1) ?? heading;
}

onMounted(() => {
  unsubscribe = controller.subscribe(receiveSnapshot);
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionChanged();
  visibilityChanged();
  updateTranslation();
  reducedMotionQuery.addEventListener("change", reducedMotionChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener("resize", updateTranslation);
  controller.start();
  ready.value = true;
});

onBeforeUnmount(() => {
  unmounted = true;
  cancelAnimationFrame(transitionResetFrame);
  unsubscribe();
  controller.dispose();
  reducedMotionQuery?.removeEventListener("change", reducedMotionChanged);
  document.removeEventListener("visibilitychange", visibilityChanged);
  window.removeEventListener("resize", updateTranslation);
});
</script>

<template>
  <section v-if="data" id="fashion-collection" class="fashion-collection">
    <div class="fashion-collection-copy">
      <small>
        {{ data.eyebrow }}
        <span aria-hidden="true" />
      </small>
      <h2>
        {{ headingLead(data.heading) }}
        <strong>{{ headingHighlight(data.heading) }}</strong>
      </h2>
      <p>{{ data.body }}</p>
      <NuxtLink to="/collections/new-arrivals">View collection</NuxtLink>
    </div>
    <div
      ref="rail"
      class="fashion-collection-rail"
      tabindex="0"
      aria-label="New arrival collections"
      :data-motion-active-index="visibleIndex"
      data-motion-direction="horizontal"
      data-motion-easing="ease"
      :data-motion-duration-ms="data.options?.speedMs ?? 300"
      :data-motion-phase="motion.phase"
      :data-motion-ready="ready"
      @keydown="keydown"
      @pointerdown="pointerDown"
      @pointerup="pointerUp"
      @pointercancel="pointerStart = null"
    >
      <div
        class="fashion-collection-track"
        :data-transition-enabled="transitionEnabled"
        :style="{ transform: `translate3d(${translateX}px, 0, 0)` }"
      >
        <article v-for="(item, index) in data.items" :key="`${item.assetId}-${index}`">
          <NuxtLink
            class="fashion-collection-card-link"
            :to="`/collections/${item.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`"
            :aria-label="`Explore ${item.name}`"
          />
          <img
            :src="properties.resolveAsset(item.assetId)"
            :alt="item.name"
            width="600"
            height="730"
            loading="lazy"
          />
          <div class="fashion-collection-card-copy">
            <h3>{{ item.name }}</h3>
            <span class="fashion-collection-tagline">{{ item.tagline }}</span>
            <NuxtLink
              class="fashion-collection-explore"
              :to="`/collections/${item.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`"
            >
              Explore collection
            </NuxtLink>
            <span class="fashion-collection-arrow" aria-hidden="true" />
          </div>
        </article>
      </div>
    </div>
    <div class="fashion-collection-watermark" aria-hidden="true">new collection</div>
  </section>
</template>
