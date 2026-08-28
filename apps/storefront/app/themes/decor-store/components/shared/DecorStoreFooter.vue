<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreRoutePaths } from "../../page-contracts";
import { decorStoreAssetId } from "../../resources";

const properties = defineProps<{ resolveAsset: ThemeAssetResolver }>();
const email = ref("");
const asset = (path: string) => properties.resolveAsset(decorStoreAssetId(path));
</script>

<template>
  <footer
    class="footer-dark bg-dark-gray pb-0 pt-0 cover-background"
    :style="{ backgroundImage: `url('${asset('images/demo-decor-store-footer-bg.jpg')}')` }"
  >
    <div class="container pt-4 pb-4 md-pt-45px md-pb-45px">
      <div class="row justify-content-center">
        <div class="col-6 col-lg-3 last-paragraph-no-margin order-sm-1 md-mb-50px xs-mb-30px">
          <a
            href="/"
            data-decor-store-route
            class="footer-logo mb-15px d-inline-block"
            aria-label="Decor Store home"
          >
            <img :src="asset('images/demo-decor-store-logo-white.png')" alt="" />
          </a>
          <p class="w-80 sm-w-100">Lorem ipsum amet adipiscing elit to eiusmod ad tempor.</p>
          <div class="elements-social social-icon-style-02 mt-15px" aria-hidden="true">
            <span class="me-15px">f</span><span class="me-15px">◉</span
            ><span class="me-15px">♥</span><span>◎</span>
          </div>
        </div>
        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fs-16 alt-font fw-500 d-block text-white mb-5px">Categories</span>
          <ul>
            <li>
              <a :href="decorStoreRoutePaths['shop-left']" data-decor-store-route>Bed room</a>
            </li>
            <li>
              <a :href="decorStoreRoutePaths['shop-left']" data-decor-store-route>Living room</a>
            </li>
            <li>
              <a :href="decorStoreRoutePaths['shop-left']" data-decor-store-route>Lightning</a>
            </li>
            <li>
              <a :href="decorStoreRoutePaths['shop-left']" data-decor-store-route>Fabrics sofa</a>
            </li>
          </ul>
        </div>
        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fs-16 alt-font fw-500 d-block text-white mb-5px">Information</span>
          <ul>
            <li><a :href="decorStoreRoutePaths.about" data-decor-store-route>About us</a></li>
            <li><a :href="decorStoreRoutePaths.contact" data-decor-store-route>Contact us</a></li>
            <li><a :href="decorStoreRoutePaths.faq" data-decor-store-route>FAQs</a></li>
            <li><a :href="decorStoreRoutePaths.faq" data-decor-store-route>Payment</a></li>
          </ul>
        </div>
        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fs-16 alt-font fw-500 d-block text-white mb-5px">Account</span>
          <ul>
            <li><a :href="decorStoreRoutePaths.account" data-decor-store-route>My account</a></li>
            <li><a :href="decorStoreRoutePaths.cart" data-decor-store-route>Orders</a></li>
            <li><a :href="decorStoreRoutePaths.checkout" data-decor-store-route>Checkout</a></li>
            <li>
              <a :href="decorStoreRoutePaths.wishlist" data-decor-store-route>My wishlists</a>
            </li>
          </ul>
        </div>
        <div class="col-lg-3 col-sm-6 ps-20px sm-ps-15px md-mb-50px xs-mb-0 order-sm-2 order-lg-5">
          <span class="fs-16 alt-font fw-500 d-block text-white mb-5px">Newsletter</span>
          <div class="mb-20px">Get everything you need succeed!</div>
          <div role="form" class="newsletter-style-02 position-relative mb-15px">
            <input
              v-model="email"
              type="email"
              class="bg-blue-tangaroa border-color-transparent-white-light w-100 form-control pe-50px ps-20px"
              placeholder="Enter your email"
            />
            <button type="button" class="btn pe-20px" aria-label="Subscribe presentation">
              <i class="feather icon-feather-mail icon-small text-white"></i>
            </button>
          </div>
          <div class="footer-card">
            <img
              v-for="number in ['01', '02', '03', '04']"
              :key="number"
              :src="asset(`images/demo-decor-store-payment-icon-${number}.png`)"
              class="d-inline-block me-5px align-middle"
              alt=""
            />
          </div>
        </div>
      </div>
    </div>
    <div class="border-top border-color-transparent-white-light pt-30px pb-30px">
      <div class="container">
        <div class="row align-items-center justify-content-center">
          <div
            class="col-xl-8 last-paragraph-no-margin text-center text-xl-start lg-mt-20px order-3 order-xl-1"
          >
            <p class="fs-14 mb-0 w-90 xl-w-100">
              This site is protected by reCAPTCHA and the Google
              <span class="text-white text-decoration-line-bottom">privacy policy</span> and terms
              of service apply.
            </p>
            <p class="fs-14 w-90 xl-w-100">
              © 2024 Crafto is Proudly Powered by
              <span class="text-white text-decoration-line-bottom">ThemeZaa</span>
            </p>
          </div>
          <div
            class="col-6 col-xl-2 col-md-3 col-sm-5 text-center text-xl-start order-1 order-xl-2"
          >
            <span class="lh-26 alt-font d-block">Need support?</span>
            <span class="fs-16 text-white fw-500">+1 234 567 8910</span>
          </div>
          <div
            class="col-6 col-xl-2 col-md-3 col-sm-5 text-center text-xl-start order-2 order-xl-3"
          >
            <span class="lh-26 alt-font d-block">Customer care</span>
            <span class="fs-16 text-white fw-500">info@domain.com</span>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
