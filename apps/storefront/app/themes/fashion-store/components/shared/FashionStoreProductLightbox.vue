<script setup lang="ts">
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
}>();

const dialog = ref<HTMLDialogElement | null>(null);
let documentOverflow = "";

function open(): void {
  documentOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  if (!dialog.value?.open) dialog.value?.showModal();
  emit("opened");
}

function close(): void {
  dialog.value?.close();
}

function handleBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) close();
}

function handleClose(): void {
  document.documentElement.style.overflow = documentOverflow;
  emit("closed");
}

onBeforeUnmount(() => {
  document.documentElement.style.overflow = documentOverflow;
});

defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="fashion-product-lightbox"
    aria-label="Product image preview"
    @click="handleBackdrop"
    @close="handleClose"
    @keydown.left.prevent="emit('previous')"
    @keydown.right.prevent="emit('next')"
  >
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
      <i class="ti-close" aria-hidden="true"></i>
    </button>
    <button
      class="fashion-product-lightbox-previous"
      type="button"
      aria-label="Previous preview image"
      @click="emit('previous')"
    >
      <i class="ti-arrow-left" aria-hidden="true"></i>
    </button>
    <button
      class="fashion-product-lightbox-next"
      type="button"
      aria-label="Next preview image"
      @click="emit('next')"
    >
      <i class="ti-arrow-right" aria-hidden="true"></i>
    </button>
  </dialog>
</template>

<style scoped>
.fashion-product-lightbox {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: #fff;
}

.fashion-product-lightbox::backdrop {
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
