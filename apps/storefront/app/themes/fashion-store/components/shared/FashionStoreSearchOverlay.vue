<script setup lang="ts">
import FashionStoreIcon from "./FashionStoreIcon.vue";
import {
  catalogSearchIndexKey,
  resolveCatalogSearchState,
  type CatalogSearchState,
} from "../../../../theme-engine/search";

const searchOpen = defineModel<boolean>({ default: false });
const catalogIndex = inject(catalogSearchIndexKey, null);
const searchError = ref(false);
const searchQuery = ref("");
const searchInput = ref<HTMLInputElement>();
const searchTrigger = ref<HTMLAnchorElement>();
const searchState = ref<CatalogSearchState>({ results: [], status: "idle" });
const searchResults = computed(() => searchState.value.results);
const searchStatus = computed(() => searchState.value.status);
const activeResult = ref(0);
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
  resetSearchResults();
  if (restoreFocus) {
    await nextTick();
    searchTrigger.value?.focus();
  }
}

async function submitSearch(): Promise<void> {
  const query = searchQuery.value.trim();
  searchError.value = query.length === 0;
  if (!query) {
    searchState.value = { results: [], status: "empty" };
    return;
  }
  if (!catalogIndex) {
    searchState.value = { results: [], status: "unavailable" };
    return;
  }
  searchState.value = { results: [], status: "loading" };
  await nextTick();
  searchState.value = resolveCatalogSearchState(catalogIndex, query);
  activeResult.value = 0;
}

function resetSearchResults(): void {
  searchError.value = false;
  searchState.value = { results: [], status: "idle" };
  activeResult.value = 0;
}

function moveResult(direction: 1 | -1): void {
  if (searchResults.value.length === 0) return;
  activeResult.value =
    (activeResult.value + direction + searchResults.value.length) % searchResults.value.length;
}

async function openActiveResult(): Promise<void> {
  const result = searchResults.value[activeResult.value];
  if (!result) {
    await submitSearch();
    return;
  }
  await closeSearch(false);
  await navigateTo(result.href);
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && searchOpen.value) {
    event.preventDefault();
    void closeSearch(true);
  }
}

watch(searchOpen, (open) => {
  if (open) document.addEventListener("keydown", handleDocumentKeydown);
  else document.removeEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
  if (searchFocusTimer) clearTimeout(searchFocusTimer);
  document.removeEventListener("keydown", handleDocumentKeydown);
});

defineExpose({ closeSearch, openSearch });
</script>

<template>
  <div class="header-search-icon icon alt-font">
    <a
      ref="searchTrigger"
      href="/shop"
      class="search-form-icon header-search-form"
      aria-label="Search"
      aria-controls="fashion-store-search"
      :aria-expanded="searchOpen"
      @click.prevent="openSearch"
      ><FashionStoreIcon name="search" class="me-5px" /><span class="d-none d-xxl-inline-block"
        >Search</span
      ></a
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
            @input="resetSearchResults"
            @keydown.down.prevent="moveResult(1)"
            @keydown.up.prevent="moveResult(-1)"
            @keydown.enter.prevent="openActiveResult"
          />
          <button type="submit" class="search-button">
            <FashionStoreIcon name="search" aria-hidden="true" />
          </button>
        </div>
        <p v-if="searchStatus === 'loading'" role="status">Searching published catalog…</p>
        <p v-else-if="searchStatus === 'empty'" role="status">
          No published catalog results match this search.
        </p>
        <p v-else-if="searchStatus === 'unavailable'" role="status">
          Catalog search is unavailable. Browse the published catalog instead.
        </p>
        <ul v-else-if="searchStatus === 'results'" aria-label="Catalog search results">
          <li v-for="(result, index) in searchResults" :key="`${result.kind}:${result.id}`">
            <a
              :href="result.href"
              data-fashion-store-route
              :aria-current="index === activeResult ? 'true' : undefined"
              @focus="activeResult = index"
            >
              {{ result.label }} <span class="visually-hidden">({{ result.kind }})</span>
            </a>
          </li>
        </ul>
      </form>
    </div>
  </div>
</template>

<style scoped>
.search-form-icon {
  display: inline-flex;
  min-width: 24px;
  min-height: 24px;
  align-items: center;
  justify-content: center;
}
</style>
