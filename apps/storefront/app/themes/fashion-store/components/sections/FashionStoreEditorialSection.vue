<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import {
  resolveFashionStoreHomeEditorial,
  resolveFashionStoreHomeSectionContext,
  resolveHomeAsset,
} from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const context = computed(() => resolveFashionStoreHomeSectionContext(properties.viewModel));
const editorial = computed(() =>
  resolveFashionStoreHomeEditorial(properties.viewModel, properties.instance),
);

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    v-if="editorial.magazine.length > 0"
    class="pb-3 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-px-0"
    data-home-section="magazine"
    :data-presentation-variant="context.presentation.editorial"
  >
    <div class="container">
      <div class="row mb-4 xs-mb-7">
        <div class="col-12 text-center">
          <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
            Fashion
            <span class="text-highlight fw-600"
              >magazine<span class="bg-base-color h-5px bottom-2px"></span
            ></span>
          </h2>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <ul
            class="blog-classic blog-wrapper grid-loading grid grid-4col xl-grid-4col lg-grid-3col md-grid-2col sm-grid-2col xs-grid-1col gutter-extra-large"
            data-anime='{ "el": "childs", "translateY": [15, 0], "translateX": [-15, 0], "opacity": [0,1], "duration": 500, "delay": 300, "staggervalue": 300, "easing": "easeOutQuad" }'
          >
            <li class="grid-sizer"></li>
            <li v-for="entry in editorial.magazine" :key="entry.name" class="grid-item">
              <article class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a
                    v-if="entry.articleHref"
                    :href="entry.articleHref"
                    :data-resource-id="entry.resourceId"
                    data-fashion-store-route
                    ><img :alt="entry.name" :src="sourceAsset(entry.sourceImage)"
                  /></a>
                  <img v-else :alt="entry.name" :src="sourceAsset(entry.sourceImage)" />
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span v-if="entry.author || entry.date" class="mb-5px d-block"
                    ><template v-if="entry.author"
                      >By
                      <a
                        :href="entry.indexHref"
                        data-fashion-store-route
                        class="text-dark-gray fw-500 categories-text"
                        >{{ entry.author }}</a
                      ></template
                    ><a
                      v-if="entry.date"
                      :href="entry.indexHref"
                      data-fashion-store-route
                      class="blog-date"
                      >{{ entry.date }}</a
                    ></span
                  >
                  <a
                    v-if="entry.articleHref"
                    :href="entry.articleHref"
                    :data-resource-id="entry.resourceId"
                    data-fashion-store-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ entry.name }}</a
                  >
                  <span
                    v-else
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ entry.name }}</span
                  >
                </div>
              </article>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
