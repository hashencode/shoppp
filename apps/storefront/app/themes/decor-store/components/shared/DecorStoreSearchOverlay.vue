<script setup lang="ts">
const emit = defineEmits<{ close: [] }>();
const input = ref<HTMLInputElement>();
const query = ref("");

onMounted(() => input.value?.focus());
</script>

<template>
  <div class="search-form-wrapper" role="dialog" aria-label="Site search" aria-modal="true">
    <button
      type="button"
      class="search-close alt-font"
      aria-label="Close search"
      @click="emit('close')"
    >
      ×
    </button>
    <form class="search-form bg-white" role="search" @submit.prevent>
      <div class="search-form-box">
        <h2 class="text-dark-gray text-center mb-7 alt-font fw-700 ls-minus-1px">
          What are you looking for?
        </h2>
        <input
          ref="input"
          v-model="query"
          class="search-input alt-font"
          placeholder="Enter your keywords..."
          type="text"
          autocomplete="off"
        />
        <button type="submit" class="search-button" aria-label="Search presentation">
          <i class="feather icon-feather-search" aria-hidden="true"></i>
        </button>
      </div>
    </form>
  </div>
</template>
