<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreProductData } from "../../fixtures/pages/product";
import { decorStoreAssetId } from "../../resources";
import DecorStoreProductCard from "../shared/DecorStoreProductCard.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

const properties = defineProps<{ resolveAsset: ThemeAssetResolver }>();
const activeImage = ref(0);
const activeTab = ref<(typeof decorStoreProductData.tabs)[number]>("Description");
const color = ref<(typeof decorStoreProductData.colors)[number]>("Natural");
const quantity = ref(1);
const wished = ref(false);
const placeholder = properties.resolveAsset(
  decorStoreAssetId("images/decor-store-placeholder.svg"),
);
</script>

<template>
  <DecorStoreShell
    active-page="product"
    :announcement="decorStoreProductData.announcement"
    :resolve-asset="resolveAsset"
  >
    <section class="pt-80px pb-80px">
      <div class="container">
        <div class="row align-items-start">
          <div class="col-lg-6 md-mb-50px">
            <img
              class="w-100"
              :src="placeholder"
              :alt="`${decorStoreProductData.name} ${decorStoreProductData.gallery[activeImage]}`"
            />
            <div class="d-flex gap-10px mt-15px" aria-label="Product gallery">
              <button
                v-for="(image, index) in decorStoreProductData.gallery"
                :key="image"
                type="button"
                :aria-pressed="activeImage === index"
                @click="activeImage = index"
              >
                {{ index + 1 }}
              </button>
            </div>
          </div>
          <div class="col-lg-5 offset-lg-1">
            <h1 class="alt-font text-dark-gray fw-700">{{ decorStoreProductData.name }}</h1>
            <p class="fs-20 fw-600">${{ decorStoreProductData.price.toFixed(2) }}</p>
            <a href="#product-details" class="text-dark-gray">165 Reviews</a>
            <p class="mt-25px">{{ decorStoreProductData.description }}</p>
            <fieldset class="border-0 p-0 mt-25px">
              <legend class="alt-font fw-600 fs-16">Color</legend>
              <label v-for="option in decorStoreProductData.colors" :key="option" class="me-15px"
                ><input v-model="color" type="radio" name="decor-product-color" :value="option" />
                {{ option }}</label
              >
            </fieldset>
            <div class="d-flex align-items-center gap-10px mt-30px">
              <button
                type="button"
                aria-label="Decrease quantity"
                @click="quantity = Math.max(1, quantity - 1)"
              >
                −
              </button>
              <output aria-label="Quantity">{{ quantity }}</output>
              <button
                type="button"
                aria-label="Increase quantity"
                @click="quantity = Math.min(9, quantity + 1)"
              >
                +
              </button>
              <button type="button" class="btn btn-dark-gray">Add to cart</button>
              <button
                type="button"
                :aria-pressed="wished"
                aria-label="Add product to wishlist"
                @click="wished = !wished"
              >
                ♡
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section id="product-details" class="pb-80px">
      <div class="container">
        <div
          role="tablist"
          aria-label="Product information"
          class="d-flex flex-wrap justify-content-center gap-20px mb-30px"
        >
          <button
            v-for="tab in decorStoreProductData.tabs"
            :id="`decor-product-tab-${tab}`"
            :key="tab"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab"
            @click="activeTab = tab"
          >
            {{ tab }}
          </button>
        </div>
        <div role="tabpanel" :aria-labelledby="`decor-product-tab-${activeTab}`">
          <h2 class="alt-font text-dark-gray fw-700">{{ activeTab }}</h2>
          <p v-if="activeTab === 'Description'">Minimalist design and modern chair.</p>
          <p v-else-if="activeTab === 'Reviews (3)'">
            25,000+ people are like our product and say good story.
          </p>
          <p v-else>
            Crafted from wood. Carefully packed and eligible for a straightforward return.
          </p>
        </div>
        <h2 class="alt-font text-dark-gray fw-700 mt-60px">Related products</h2>
        <ul class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 list-unstyled">
          <DecorStoreProductCard
            v-for="product in decorStoreProductData.related"
            :key="product.id"
            :placeholder="placeholder"
            :product="product"
          />
        </ul>
      </div>
    </section>
  </DecorStoreShell>
</template>
