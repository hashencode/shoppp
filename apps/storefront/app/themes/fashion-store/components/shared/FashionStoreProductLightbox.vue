<script setup lang="ts">
import FashionStoreIcon from "./FashionStoreIcon.vue";
const properties = defineProps<{
  alt: string;
  current: number;
  src: string;
  total: number;
}>();

const emit = defineEmits<{
  closed: [];
  next: [];
  opened: [];
  previous: [];
  unavailable: [];
}>();

type BootstrapModal = {
  dispose(): void;
  hide(): void;
  show(relatedTarget?: Element): void;
};

const modal = ref<HTMLElement | null>(null);
const retryButton = ref<HTMLButtonElement | null>(null);
const loadFailed = ref(false);
let instance: BootstrapModal | undefined;
let loading: Promise<void> | undefined;
let mounted = false;
let openRequested = false;
let returnFocus: HTMLElement | undefined;

function rememberReturnFocus(): void {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement !== modal.value) {
    returnFocus = activeElement;
  }
}

function restoreFocus(): void {
  const target = returnFocus;
  returnFocus = undefined;
  if (target?.isConnected && !modal.value?.contains(target)) target.focus();
}

function handleOpened(): void {
  emit("opened");
}

function handleClosed(): void {
  restoreFocus();
  emit("closed");
}

async function createAndShow(): Promise<void> {
  const element = modal.value;
  if (!element) return;
  // Bootstrap publishes types for its package entry, not its independently loadable JS module.
  // @ts-expect-error bootstrap/js/dist/modal has no declaration file.
  const { default: Modal } = await import("bootstrap/js/dist/modal");
  if (!mounted || !openRequested || !modal.value) return;
  const nextInstance = new Modal(element, {
    backdrop: true,
    focus: true,
    keyboard: true,
  }) as BootstrapModal;
  instance = nextInstance;
  element.addEventListener("shown.bs.modal", handleOpened);
  element.addEventListener("hidden.bs.modal", handleClosed);
  nextInstance.show(returnFocus);
}

function open(): void {
  if (!mounted) return;
  openRequested = true;
  rememberReturnFocus();
  if (instance) {
    instance.show(returnFocus);
    return;
  }
  if (loading) return;
  loading = createAndShow()
    .catch(async () => {
      // Keep the gallery usable when the optional client module is unavailable.
      openRequested = false;
      loadFailed.value = true;
      emit("unavailable");
      await nextTick();
      retryButton.value?.focus();
    })
    .finally(() => {
      loading = undefined;
    });
}

function reloadForRetry(): void {
  window.location.reload();
}

function close(): void {
  openRequested = false;
  instance?.hide();
}

onMounted(() => {
  mounted = true;
});

onBeforeUnmount(() => {
  mounted = false;
  openRequested = false;
  const element = modal.value;
  element?.removeEventListener("shown.bs.modal", handleOpened);
  element?.removeEventListener("hidden.bs.modal", handleClosed);
  instance?.hide();
  instance?.dispose();
  instance = undefined;
});

defineExpose({ open });
</script>

<template>
  <div v-if="loadFailed" class="fashion-product-lightbox-error" role="alert">
    <span>Product image preview could not load.</span>
    <button ref="retryButton" type="button" @click="reloadForRetry">Reload and retry</button>
  </div>
  <div
    ref="modal"
    class="modal fashion-product-lightbox"
    tabindex="-1"
    aria-label="Product image preview"
    @keydown.left.prevent="emit('previous')"
    @keydown.right.prevent="emit('next')"
  >
    <div class="modal-dialog modal-fullscreen m-0">
      <div class="modal-content border-0 rounded-0">
        <figure class="fashion-product-lightbox-figure">
          <img :src="properties.src" :alt="properties.alt" width="600" height="765" />
          <figcaption class="fashion-product-lightbox-caption">
            <span>{{ properties.alt }}</span>
            <span>{{ properties.current }} of {{ properties.total }}</span>
          </figcaption>
        </figure>

        <button
          class="fashion-product-lightbox-close"
          type="button"
          aria-label="Close product image preview"
          @click="close"
        >
          <FashionStoreIcon name="x" aria-hidden="true" />
        </button>
        <button
          class="fashion-product-lightbox-previous"
          type="button"
          aria-label="Previous preview image"
          @click="emit('previous')"
        >
          <FashionStoreIcon name="arrow-left" aria-hidden="true" />
        </button>
        <button
          class="fashion-product-lightbox-next"
          type="button"
          aria-label="Next preview image"
          @click="emit('next')"
        >
          <FashionStoreIcon name="arrow-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fashion-product-lightbox {
  overflow: hidden;
  background: transparent;
  color: #fff;
}

.fashion-product-lightbox-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-block: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid currentcolor;
}

.fashion-product-lightbox .modal-content {
  height: 100%;
  background: rgb(11 11 11 / 80%);
}

:global(.modal-backdrop) {
  --bs-backdrop-opacity: 1;
  background: rgb(11 11 11 / 80%);
}

.fashion-product-lightbox-figure {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: calc(100vw - 180px);
  height: 100dvh;
  margin: 0;
  line-height: 0;
  transform: translate(-50%, -50%);
  animation: fashion-product-lightbox-fade 0.4s both;
}

.fashion-product-lightbox-figure img {
  display: block;
  width: auto;
  height: 100%;
  max-width: 100%;
  padding: 40px 0;
  object-fit: contain;
}

.fashion-product-lightbox-caption {
  position: absolute;
  right: 0;
  bottom: 6px;
  left: 0;
  display: flex;
  justify-content: space-between;
  color: #f3f3f3;
  font-size: 12px;
  line-height: 18px;
}

.fashion-product-lightbox button {
  position: absolute;
  z-index: 1;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
}

.fashion-product-lightbox-close {
  top: 40px;
  right: 40px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff !important;
  color: #232323 !important;
  font-size: 16px;
}

.fashion-product-lightbox-previous,
.fashion-product-lightbox-next {
  top: 50%;
  width: 60px;
  height: 60px;
  font-size: 20px;
  transform: translateY(-50%);
}

.fashion-product-lightbox-previous {
  left: 30px;
}

.fashion-product-lightbox-next {
  right: 30px;
}

@keyframes fashion-product-lightbox-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 800px) {
  .fashion-product-lightbox-figure {
    max-width: calc(100vw - 12px);
  }

  .fashion-product-lightbox-figure img {
    width: 100%;
    height: auto;
    max-height: 100dvh;
    padding: 0;
  }

  .fashion-product-lightbox-caption {
    bottom: 3px;
    padding: 3px 5px;
    background: rgb(0 0 0 / 60%);
  }

  .fashion-product-lightbox-close {
    top: 0;
    right: 0;
    width: 35px;
    height: 35px;
    border-radius: 0;
    background: rgb(0 0 0 / 60%) !important;
    color: #fff !important;
  }

  .fashion-product-lightbox-previous {
    left: 0;
    transform: translateY(-50%) scale(0.75);
    transform-origin: left center;
  }

  .fashion-product-lightbox-next {
    right: 0;
    transform: translateY(-50%) scale(0.75);
    transform-origin: right center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fashion-product-lightbox-figure {
    animation: none;
  }
}
</style>
