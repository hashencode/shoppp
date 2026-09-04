<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from "vue";

defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ as?: "button" | "a"; content: string }>(), { as: "button" });

const trigger = ref<HTMLElement>();
const tooltip = ref<HTMLElement>();
const tooltipId = useId();
const open = ref(false);
const positioned = ref(false);
const placement = ref<"left" | "right" | "top" | "bottom">("left");
const position = ref({
  left: "0px",
  top: "0px",
  "--fashion-tooltip-arrow": "50%",
  "--fashion-tooltip-max-width": "calc(100vw - 16px)",
});
let hovered = false;
let focused = false;
let frame = 0;

function positionTooltip(): void {
  if (!open.value || !trigger.value || !tooltip.value) return;
  const target = trigger.value.getBoundingClientRect();
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? document.documentElement.clientWidth;
  const height = viewport?.height ?? window.innerHeight;
  const gap = 6;
  const margin = 8;
  if (
    target.bottom <= top ||
    target.top >= top + height ||
    target.right <= left ||
    target.left >= left + width
  ) {
    hide();
    return;
  }
  const maxWidth = Math.max(1, width - margin * 2);
  tooltip.value.style.setProperty("--fashion-tooltip-max-width", `${maxWidth}px`);
  const bounds = tooltip.value.getBoundingClientRect();
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  const candidates = [
    { side: "left", x: target.left - bounds.width - gap, y: centerY - bounds.height / 2 },
    { side: "top", x: centerX - bounds.width / 2, y: target.top - bounds.height - gap },
    { side: "right", x: target.right + gap, y: centerY - bounds.height / 2 },
    { side: "bottom", x: centerX - bounds.width / 2, y: target.bottom + gap },
  ] as const;
  const candidate =
    candidates.find(
      ({ x, y }) =>
        x >= left + margin &&
        y >= top + margin &&
        x + bounds.width <= left + width - margin &&
        y + bounds.height <= top + height - margin,
    ) ?? candidates[0];
  const x = Math.max(left + margin, Math.min(candidate.x, left + width - bounds.width - margin));
  const y = Math.max(top + margin, Math.min(candidate.y, top + height - bounds.height - margin));
  const verticalSide = candidate.side === "left" || candidate.side === "right";
  const arrow = Math.max(
    8,
    Math.min(
      verticalSide ? centerY - y : centerX - x,
      (verticalSide ? bounds.height : bounds.width) - 8,
    ),
  );
  placement.value = candidate.side;
  position.value = {
    left: `${x}px`,
    top: `${y}px`,
    "--fashion-tooltip-arrow": `${arrow}px`,
    "--fashion-tooltip-max-width": `${maxWidth}px`,
  };
  positioned.value = true;
}

function schedulePosition(): void {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    positionTooltip();
  });
}

function stopPositioning(): void {
  window.removeEventListener("scroll", schedulePosition, true);
  window.removeEventListener("resize", schedulePosition);
  window.visualViewport?.removeEventListener("scroll", schedulePosition);
  window.visualViewport?.removeEventListener("resize", schedulePosition);
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
}

async function show(): Promise<void> {
  if (open.value) return;
  open.value = true;
  positioned.value = false;
  window.addEventListener("scroll", schedulePosition, true);
  window.addEventListener("resize", schedulePosition);
  window.visualViewport?.addEventListener("scroll", schedulePosition);
  window.visualViewport?.addEventListener("resize", schedulePosition);
  await nextTick();
  positionTooltip();
}

function hide(): void {
  open.value = false;
  stopPositioning();
}

function enter(): void {
  hovered = true;
  void show();
}

function leave(): void {
  hovered = false;
  if (!focused) hide();
}

function focus(): void {
  focused = true;
  void show();
}

function blur(): void {
  focused = false;
  if (!hovered) hide();
}

onBeforeUnmount(stopPositioning);
</script>

<template>
  <component
    :is="as"
    ref="trigger"
    v-bind="$attrs"
    :aria-describedby="open ? tooltipId : undefined"
    @mouseenter="enter"
    @mouseleave="leave"
    @focus="focus"
    @blur="blur"
    @keydown.esc="hide"
  >
    <slot />
  </component>
  <Teleport v-if="open" to="body">
    <div
      ref="tooltip"
      :id="tooltipId"
      role="tooltip"
      :aria-label="content"
      class="fashion-store-tooltip"
      :data-placement="placement"
      :style="[position, { visibility: positioned ? 'visible' : 'hidden' }]"
    >
      {{ content }}
    </div>
  </Teleport>
</template>

<style scoped>
.fashion-store-tooltip {
  position: fixed;
  z-index: 1080;
  max-width: min(200px, var(--fashion-tooltip-max-width));
  box-sizing: border-box;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: var(--bs-emphasis-color, #000);
  color: var(--bs-body-bg, #fff);
  font-family: var(--bs-font-sans-serif, sans-serif);
  font-size: 0.875rem;
  font-weight: 400;
  font-style: normal;
  line-height: 1.5;
  text-align: center;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  overflow-wrap: break-word;
  opacity: 0.9;
  pointer-events: none;
  animation: fashion-tooltip-in 150ms linear;
}
.fashion-store-tooltip::before {
  position: absolute;
  content: "";
  border: solid transparent;
}
.fashion-store-tooltip[data-placement="left"]::before {
  left: 100%;
  top: var(--fashion-tooltip-arrow);
  transform: translateY(-50%);
  border-width: 0.4rem 0 0.4rem 0.4rem;
  border-left-color: var(--bs-emphasis-color, #000);
}
.fashion-store-tooltip[data-placement="right"]::before {
  right: 100%;
  top: var(--fashion-tooltip-arrow);
  transform: translateY(-50%);
  border-width: 0.4rem 0.4rem 0.4rem 0;
  border-right-color: var(--bs-emphasis-color, #000);
}
.fashion-store-tooltip[data-placement="top"]::before {
  top: 100%;
  left: var(--fashion-tooltip-arrow);
  transform: translateX(-50%);
  border-width: 0.4rem 0.4rem 0;
  border-top-color: var(--bs-emphasis-color, #000);
}
.fashion-store-tooltip[data-placement="bottom"]::before {
  bottom: 100%;
  left: var(--fashion-tooltip-arrow);
  transform: translateX(-50%);
  border-width: 0 0.4rem 0.4rem;
  border-bottom-color: var(--bs-emphasis-color, #000);
}
@keyframes fashion-tooltip-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.9;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fashion-store-tooltip {
    animation: none;
  }
}
</style>
