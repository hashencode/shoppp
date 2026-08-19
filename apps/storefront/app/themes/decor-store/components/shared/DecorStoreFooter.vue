<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreRoutePaths } from "../../page-contracts";
import { decorStoreAssetId } from "../../resources";

const properties = defineProps<{ resolveAsset: ThemeAssetResolver }>();
const email = ref("");
const asset = (path: string) => properties.resolveAsset(decorStoreAssetId(path));
onBeforeUnmount(() => {
  email.value = "";
});
</script>

<template>
  <footer
    class="footer-dark bg-dark-gray pb-0 pt-0 cover-background"
    :style="{ backgroundImage: `url('${asset('images/demo-decor-store-footer-bg.jpg')}')` }"
  >
    <div class="container">
      <div class="row justify-content-center pt-6 pb-6">
        <div class="col-12 col-lg-3 col-md-6 md-mb-30px">
          <a href="/" data-decor-store-route class="footer-logo" aria-label="Decor Store home">
            <img :src="asset('images/demo-decor-store-logo-white.png')" alt="" />
          </a>
          <p class="mt-20px">Elevate your home with our stylish decor.</p>
        </div>
        <div class="col-6 col-lg-2 col-md-3">
          <span class="alt-font fw-600 d-block text-white mb-10px">Categories</span>
          <ul>
            <li>
              <a :href="decorStoreRoutePaths['shop-left']" data-decor-store-route>Furniture</a>
            </li>
            <li>
              <a :href="decorStoreRoutePaths.collection" data-decor-store-route>Collections</a>
            </li>
            <li><a :href="decorStoreRoutePaths.product" data-decor-store-route>Decor</a></li>
          </ul>
        </div>
        <div class="col-6 col-lg-2 col-md-3">
          <span class="alt-font fw-600 d-block text-white mb-10px">Information</span>
          <ul>
            <li><a :href="decorStoreRoutePaths.about" data-decor-store-route>About us</a></li>
            <li><a :href="decorStoreRoutePaths.contact" data-decor-store-route>Contact us</a></li>
            <li><a :href="decorStoreRoutePaths.faq" data-decor-store-route>FAQs</a></li>
          </ul>
        </div>
        <div class="col-12 col-lg-4 md-mt-30px">
          <span class="alt-font fw-600 d-block text-white mb-10px"
            >Subscribe to our newsletter</span
          >
          <form class="newsletter-style-04 position-relative" @submit.prevent>
            <input
              v-model="email"
              type="email"
              class="form-control"
              placeholder="Enter your email"
            />
            <button type="submit" class="btn" aria-label="Subscribe presentation">
              <i class="bi bi-envelope"></i>
            </button>
          </form>
        </div>
      </div>
      <div class="row border-top border-color-transparent-white-light pt-25px pb-25px">
        <div class="col text-center">© 2026 Crafto Decor Store</div>
      </div>
    </div>
  </footer>
</template>
