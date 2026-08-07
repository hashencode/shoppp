<script setup lang="ts">
import { fashionStoreRoutePaths } from "../../page-contracts";

const properties = defineProps<{
  sourceAsset: (sourcePath: string) => string;
}>();

const sourceInlineGap = " ";
const sourceAsset = (sourcePath: string) => properties.sourceAsset(sourcePath);
const highDensity = ref(false);

onMounted(() => {
  highDensity.value = window.devicePixelRatio > 1;
});

function densityAsset(standardPath: string, highDensityPath: string): string {
  return sourceAsset(highDensity.value ? highDensityPath : standardPath);
}
</script>

<template>
  <footer class="footer-dark bg-dark-gray p-0">
    <div class="container">
      <div class="row align-items-center pt-35px pb-35px">
        <div class="col-12 col-md-auto sm-mb-15px text-center text-md-start">
          <a href="/" data-fashion-store-route class="footer-logo" aria-label="Lifestyle home"
            ><img
              alt=""
              class="default-logo"
              v-bind:src="
                densityAsset(
                  'images/demo-fashion-store-logo-white.png',
                  'images/demo-fashion-store-logo-white@2x.png',
                )
              "
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-white@2x.png')"
          /></a>
        </div>

        <div class="col">
          <ul class="footer-navbar text-center text-md-end">
            <li class="nav-item"><a href="/" data-fashion-store-route class="nav-link">Home</a></li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a
                :href="fashionStoreRoutePaths['shop-left']"
                data-fashion-store-route
                class="nav-link"
                >Shop</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a :href="fashionStoreRoutePaths.collection" data-fashion-store-route class="nav-link"
                >Collection</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a :href="fashionStoreRoutePaths.magazine" data-fashion-store-route class="nav-link"
                >Magazine</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a :href="fashionStoreRoutePaths.about" data-fashion-store-route class="nav-link"
                >About</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a :href="fashionStoreRoutePaths.contact" data-fashion-store-route class="nav-link"
                >Contact</a
              >
            </li>
          </ul>
        </div>
      </div>
      <div class="row justify-content-center fs-15 lh-28 pb-50px xs-pb-35px">
        <div class="col-12 mb-50px sm-mb-35px">
          <div
            class="divider-style-03 divider-style-03-01 border-color-transparent-white-light"
          ></div>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Categories</span>
          <ul>
            <li><a href="/" data-fashion-store-route>Men</a></li>
            <li><a href="/" data-fashion-store-route>Women</a></li>
            <li><a href="/" data-fashion-store-route>Accessories</a></li>
            <li><a href="/" data-fashion-store-route>Shoes</a></li>
            <li><a href="/" data-fashion-store-route>Dresses</a></li>
          </ul>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Information</span>
          <ul>
            <li><a :href="fashionStoreRoutePaths.about" data-fashion-store-route>About us</a></li>
            <li>
              <a :href="fashionStoreRoutePaths.contact" data-fashion-store-route>Contact us</a>
            </li>
            <li><a href="/" data-fashion-store-route>Terms &amp; conditions</a></li>
            <li><a href="/" data-fashion-store-route>Shipping &amp; delivery</a></li>
            <li><a href="/" data-fashion-store-route>Privacy policy</a></li>
          </ul>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Quick links</span>
          <ul>
            <li>
              <a :href="fashionStoreRoutePaths.account" data-fashion-store-route>My account</a>
            </li>
            <li><a href="/" data-fashion-store-route>Orders tracking</a></li>
            <li><a href="/" data-fashion-store-route>Our store</a></li>
            <li><a href="/" data-fashion-store-route>Size guide</a></li>
            <li><a :href="fashionStoreRoutePaths.faq" data-fashion-store-route>FAQs</a></li>
          </ul>
        </div>

        <div
          class="col-6 col-lg-3 col-md-4 col-sm-5 md-mb-50px xs-mb-30px order-sm-2 order-lg-2 offset-md-2 offset-lg-0"
        >
          <span class="fw-500 d-block text-white mb-10px fs-17">Quick contact</span>
          <div>
            <i class="feather icon-feather-phone-call fs-16 text-white me-10px xs-me-5px"></i
            ><a href="tel:1234567890">123 456 7890</a>
          </div>
          <div class="mb-15px">
            <i class="feather icon-feather-mail fs-16 text-white me-10px xs-me-5px"></i
            ><a href="mailto:info@domain.com" class="text-decoration-line-bottom"
              >info@domain.com</a
            >
          </div>
          <span class="fw-500 d-block text-white mb-5px fs-17">Connect with us</span>
          <div class="elements-social social-icon-style-02">
            <ul class="light">
              <li>
                <a
                  class="facebook"
                  href="https://www.facebook.com/"
                  target="_blank"
                  aria-label="Facebook"
                  ><i class="fa-brands fa-facebook-f"></i
                ></a>
              </li>
              {{
                sourceInlineGap
              }}
              <li>
                <a
                  class="dribbble"
                  href="http://www.dribbble.com"
                  target="_blank"
                  aria-label="Dribbble"
                  ><i class="fa-brands fa-dribbble"></i
                ></a>
              </li>
              {{
                sourceInlineGap
              }}
              <li>
                <a
                  class="twitter"
                  href="http://www.twitter.com"
                  target="_blank"
                  aria-label="Twitter"
                  ><i class="fa-brands fa-twitter"></i
                ></a>
              </li>
              {{
                sourceInlineGap
              }}
              <li>
                <a
                  class="instagram"
                  href="http://www.instagram.com"
                  target="_blank"
                  aria-label="Instagram"
                  ><i class="fa-brands fa-instagram"></i
                ></a>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="col-lg-3 col-md-6 col-sm-7 ps-20px sm-ps-15px md-mb-50px xs-mb-0 order-sm-1 order-lg-5"
        >
          <span class="fw-500 d-block text-white mb-5px fs-17">Become a member</span>
          <div class="mb-15px">Join now and get 20% extra discount!</div>
          <div class="d-inline-block w-100 newsletter-style-04 position-relative mb-15px">
            <form action="#" method="post" class="position-relative w-100" v-on:submit.prevent="">
              <input
                class="input-small bg-nero-grey border-radius-4px fs-14 border-color-transparent w-100 form-control pe-50px ps-20px lg-ps-15px required"
                type="email"
                name="email"
                placeholder="Enter your email"
              />
              <input type="hidden" name="redirect" value="" />
              <button class="btn pe-20px submit" aria-label="submit">
                <i class="icon bi bi-envelope icon-small text-white"></i>
              </button>
              <div
                class="form-results border-radius-4px pt-5px pb-5px ps-15px pe-15px fs-14 lh-22 mt-10px w-100 text-center position-absolute d-none"
              ></div>
            </form>
          </div>
          <div class="footer-card">
            <a
              href="/"
              data-fashion-store-route
              class="d-inline-block me-5px align-middle"
              aria-label="Visa payment information"
              ><img
                alt=""
                v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-01.png')" /></a
            >{{ sourceInlineGap }}
            <a
              href="/"
              data-fashion-store-route
              class="d-inline-block me-5px align-middle"
              aria-label="PayPal payment information"
              ><img
                alt=""
                v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-02.png')" /></a
            >{{ sourceInlineGap }}
            <a
              href="/"
              data-fashion-store-route
              class="d-inline-block me-5px align-middle"
              aria-label="Mastercard payment information"
              ><img
                alt=""
                v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-03.png')" /></a
            >{{ sourceInlineGap }}
            <a
              href="/"
              data-fashion-store-route
              class="d-inline-block me-5px align-middle"
              aria-label="American Express payment information"
              ><img alt="" v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-04.png')"
            /></a>
          </div>
        </div>
      </div>
    </div>
    <div class="pt-30px pb-30px bg-nero-grey">
      <div class="container">
        <div class="row align-items-center fs-15">
          <div
            class="col-12 col-lg-7 last-paragraph-no-margin md-mb-15px text-center text-lg-start lh-22"
          >
            <p>
              This site is protected by reCAPTCHA and the Google
              <a href="/" data-fashion-store-route class="text-white text-decoration-line-bottom"
                >privacy policy</a
              >
              and
              <a href="/" data-fashion-store-route class="text-white text-decoration-line-bottom"
                >terms of service.</a
              >
            </p>
          </div>
          <div class="col-12 col-lg-5 text-center text-lg-end lh-22">
            <span
              >© 2024 Crafto is Proudly Powered by
              <a
                href="https://www.themezaa.com/"
                target="_blank"
                class="text-decoration-line-bottom text-white"
                >ThemeZaa</a
              ></span
            >
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
