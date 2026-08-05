<script setup lang="ts">
const properties = defineProps<{
  alt: string;
  src: string;
}>();
const emit = defineEmits<{
  closed: [];
  next: [];
  opened: [];
  previous: [];
}>();
const dialog = ref<HTMLDialogElement | null>(null);

function open(): void {
  dialog.value?.showModal();
  emit("opened");
}

function close(): void {
  dialog.value?.close();
}

defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="theme-product-lightbox"
    aria-label="Product image preview"
    @close="emit('closed')"
    @keydown.left.prevent="emit('previous')"
    @keydown.right.prevent="emit('next')"
  >
    <button
      class="theme-product-lightbox-close"
      type="button"
      aria-label="Close product image preview"
      @click="close"
    >
      ×
    </button>
    <button
      class="theme-product-lightbox-previous"
      type="button"
      aria-label="Previous preview image"
      @click="emit('previous')"
    >
      ‹
    </button>
    <img :src="properties.src" :alt="properties.alt" width="600" height="650" />
    <button
      class="theme-product-lightbox-next"
      type="button"
      aria-label="Next preview image"
      @click="emit('next')"
    >
      ›
    </button>
  </dialog>
</template>

<style scoped>
.theme-product-lightbox {
  position: fixed;
  width: min(92vw, 760px);
  max-width: none;
  padding: 36px;
  border: 0;
  background: transparent;
  overflow: visible;
}
.theme-product-lightbox::backdrop {
  background: rgb(0 0 0 / 88%);
}
.theme-product-lightbox img {
  display: block;
  width: 100%;
  max-height: 82vh;
  object-fit: contain;
}
.theme-product-lightbox button {
  position: absolute;
  z-index: 1;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(0 0 0 / 55%);
  color: #fff;
  cursor: pointer;
}
.theme-product-lightbox-close {
  top: -2px;
  right: -2px;
  width: 40px;
  height: 40px;
  font: 30px/1 sans-serif;
}
.theme-product-lightbox-previous,
.theme-product-lightbox-next {
  top: 50%;
  width: 46px;
  height: 46px;
  font: 38px/1 sans-serif;
  transform: translateY(-50%);
}
.theme-product-lightbox-previous {
  left: -18px;
}
.theme-product-lightbox-next {
  right: -18px;
}
@media (max-width: 520px) {
  .theme-product-lightbox {
    width: 100vw;
    padding: 28px;
  }
  .theme-product-lightbox-previous {
    left: 4px;
  }
  .theme-product-lightbox-next {
    right: 4px;
  }
}
</style>
