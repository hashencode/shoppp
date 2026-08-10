<script setup lang="ts">
const searchOpen = defineModel<boolean>({ default: false });
const searchError = ref(false);
const searchQuery = ref("");
const searchInput = ref<HTMLInputElement>();
const searchTrigger = ref<HTMLAnchorElement>();
let searchFocusTimer: ReturnType<typeof setTimeout> | undefined;

async function openSearch(): Promise<void> {
  searchOpen.value = true;
  await nextTick();
  if (searchFocusTimer) clearTimeout(searchFocusTimer);
  searchFocusTimer = setTimeout(() => {
    if (searchOpen.value) searchInput.value?.focus();
  }, 250);
}

async function closeSearch(restoreFocus = false): Promise<void> {
  if (searchFocusTimer) clearTimeout(searchFocusTimer);
  searchOpen.value = false;
  searchError.value = false;
  if (restoreFocus) {
    await nextTick();
    searchTrigger.value?.focus();
  }
}

function submitSearch(): void {
  searchError.value = searchQuery.value.trim().length === 0;
}

onBeforeUnmount(() => {
  if (searchFocusTimer) clearTimeout(searchFocusTimer);
});

defineExpose({ closeSearch, openSearch });
</script>

<template>
  <div class="header-search-icon icon alt-font">
    <a
      ref="searchTrigger"
      href="#"
      class="search-form-icon header-search-form"
      aria-label="Search"
      aria-controls="fashion-store-search"
      :aria-expanded="searchOpen"
      @click.prevent="openSearch"
      ><i class="feather icon-feather-search me-5px"></i
      ><span class="d-none d-xxl-inline-block">Search</span></a
    >
    <div
      id="fashion-store-search"
      class="search-form-wrapper"
      :aria-hidden="!searchOpen"
      @click.self="closeSearch(true)"
    >
      <button title="Close" type="button" class="search-close alt-font" @click="closeSearch(true)">
        ×
      </button>
      <form
        id="search-form"
        role="search"
        class="search-form text-left"
        @submit.prevent="submitSearch"
      >
        <div class="search-form-box">
          <h2 class="text-dark-gray text-center mb-4 fw-600 alt-font ls-minus-1px">
            What are you looking for?
          </h2>
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="search-input alt-font"
            :class="{ 'search-error': searchError }"
            id="search-form-input5e219ef164995"
            placeholder="Enter your keywords..."
            name="s"
            type="text"
            autocomplete="off"
            @input="searchError = false"
          />
          <button type="submit" class="search-button">
            <i class="feather icon-feather-search" aria-hidden="true"></i>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
