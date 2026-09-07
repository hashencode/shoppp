<script setup lang="ts">
import { fashionStoreRoutePaths } from "../../page-contracts";
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData } from "./fixture-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));
import { resolveHomeAsset } from "./fixture-home-section-context";

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    class="pt-0 pb-0 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-p-0"
    data-home-section="categories"
    :data-presentation-variant="presentation.categories"
  >
    <div class="container-fluid">
      <div
        class="row row-cols-1 row-cols-xl-4 row-cols-lg-2 row-cols-md-2"
        data-anime='{ "el": "childs", "translateY": [-15, 0], "perspective": [1200,1200], "scale": [1.1, 1], "rotateX": [50, 0], "opacity": [0,1], "duration": 400, "delay": 100, "staggervalue": 200, "easing": "easeOutQuad" }'
      >
        <div class="col categories-style-02 lg-mb-30px">
          <div class="categories-box">
            <a
              :href="fashionStoreRoutePaths.collection"
              data-fashion-store-route
              v-bind:aria-label="'View ' + data.categories[0].name"
            >
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[0].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[0].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[0].name">{{
                    data.categories[0].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div class="col categories-style-02 lg-mb-30px">
          <div class="categories-box">
            <a
              :href="fashionStoreRoutePaths.collection"
              data-fashion-store-route
              v-bind:aria-label="'View ' + data.categories[1].name"
            >
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[1].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[1].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[1].name">{{
                    data.categories[1].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div class="col categories-style-02 sm-mb-30px">
          <div class="categories-box">
            <a
              :href="fashionStoreRoutePaths.collection"
              data-fashion-store-route
              v-bind:aria-label="'View ' + data.categories[2].name"
            >
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[2].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[2].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[2].name">{{
                    data.categories[2].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div class="col categories-style-02">
          <div class="categories-box">
            <a
              :href="fashionStoreRoutePaths.collection"
              data-fashion-store-route
              v-bind:aria-label="'View ' + data.categories[3].name"
            >
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[3].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[3].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[3].name">{{
                    data.categories[3].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
