<script setup lang="ts">
import { fashionStoreRoutePaths } from "../../page-contracts";
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData } from "./fixture-home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
import { resolveHomeAsset } from "./fixture-home-section-context";

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section class="pb-3 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-px-0" data-home-section="magazine">
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

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                    ><img
                      v-bind:alt="data.magazine[0].name"
                      v-bind:src="sourceAsset(data.magazine[0].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[0].author }}</a
                    ><a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="blog-date"
                      >{{ data.magazine[0].date }}</a
                    ></span
                  >
                  <a
                    :href="fashionStoreRoutePaths.article"
                    data-fashion-store-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[0].name }}</a
                  >
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                    ><img
                      v-bind:alt="data.magazine[1].name"
                      v-bind:src="sourceAsset(data.magazine[1].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[1].author }}</a
                    ><a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="blog-date"
                      >{{ data.magazine[1].date }}</a
                    ></span
                  >
                  <a
                    :href="fashionStoreRoutePaths.article"
                    data-fashion-store-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[1].name }}</a
                  >
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                    ><img
                      v-bind:alt="data.magazine[2].name"
                      v-bind:src="sourceAsset(data.magazine[2].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[2].author }}</a
                    ><a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="blog-date"
                      >{{ data.magazine[2].date }}</a
                    ></span
                  >
                  <a
                    :href="fashionStoreRoutePaths.article"
                    data-fashion-store-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[2].name }}</a
                  >
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                    ><img
                      v-bind:alt="data.magazine[3].name"
                      v-bind:src="sourceAsset(data.magazine[3].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[3].author }}</a
                    ><a
                      :href="fashionStoreRoutePaths.magazine"
                      data-fashion-store-route
                      class="blog-date"
                      >{{ data.magazine[3].date }}</a
                    ></span
                  >
                  <a
                    :href="fashionStoreRoutePaths.article"
                    data-fashion-store-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[3].name }}</a
                  >
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
