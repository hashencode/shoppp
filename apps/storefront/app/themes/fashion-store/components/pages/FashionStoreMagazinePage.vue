<script setup lang="ts">
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreEditorialCard from "../shared/FashionStoreEditorialCard.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Magazine requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreContentData).magazine;
});
const paginationIntentCount = ref(0);

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function retainPaginationPresentation(): void {
  paginationIntentCount.value += 1;
}
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    :preload-image="sourceAsset(data.posts[0]!.sourceImage)"
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-magazine
      data-runtime-status="ready"
      :data-pagination-intent-count="paginationIntentCount"
    >
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container">
          <div class="row align-items-center justify-content-center">
            <div
              class="col-12 col-xl-8 col-lg-10 text-center position-relative page-title-extra-large"
            >
              <h1 class="alt-font fw-600 text-dark-gray mb-10px">Magazine</h1>
            </div>
            <nav
              class="col-12 breadcrumb breadcrumb-style-01 d-flex justify-content-center"
              aria-label="Breadcrumb"
            >
              <ul>
                <li>
                  <a :href="fashionStoreRoutePaths.home" data-fashion-store-route>Home</a
                  ><FashionStoreIcon name="chevron-right" class="fashion-breadcrumb-separator" />
                </li>
                {{
                  " "
                }}
                <li>Magazine</li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <section class="pt-0 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-px-0 fashion-magazine-body">
        <div class="container-fluid">
          <div class="row">
            <div class="col-12">
              <ul
                class="blog-classic blog-wrapper grid grid-4col xl-grid-4col lg-grid-3col md-grid-2col sm-grid-2col xs-grid-1col gutter-extra-large fashion-magazine-grid"
              >
                <li class="grid-sizer" aria-hidden="true"></li>
                <FashionStoreEditorialCard
                  v-for="post in data.posts"
                  :key="post.sourceImage"
                  :author="post.author"
                  :date="post.date"
                  :href="fashionStoreRoutePaths.article"
                  :image="sourceAsset(post.sourceImage)"
                  :title="post.title"
                />
              </ul>
              <div class="row">
                <div class="col-12 mt-2 d-flex justify-content-center">
                  <nav aria-label="Magazine pages">
                    <ul
                      class="pagination pagination-style-01 fs-13 mb-0 fashion-magazine-pagination"
                    >
                      <li class="page-item">
                        <button
                          type="button"
                          class="page-link"
                          aria-label="Previous page"
                          @click="retainPaginationPresentation"
                        >
                          <FashionStoreIcon name="arrow-left" class="fs-18 d-xs-none" />
                        </button>
                      </li>
                      <li
                        v-for="page in data.pagination.pages"
                        :key="page"
                        class="page-item"
                        :class="{ active: page === data.pagination.active }"
                      >
                        <button
                          type="button"
                          class="page-link"
                          :aria-current="page === data.pagination.active ? 'page' : undefined"
                          @click="retainPaginationPresentation"
                        >
                          {{ page }}
                        </button>
                      </li>
                      <li class="page-item">
                        <button
                          type="button"
                          class="page-link"
                          aria-label="Next page"
                          @click="retainPaginationPresentation"
                        >
                          <FashionStoreIcon name="arrow-right" class="fs-18 d-xs-none" />
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
