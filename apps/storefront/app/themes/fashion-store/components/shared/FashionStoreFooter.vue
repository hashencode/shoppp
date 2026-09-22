<script setup lang="ts">
import FashionStoreIcon from "./FashionStoreIcon.vue";
import { fashionStoreRoutePaths } from "../../page-contracts";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { liveCommerceModeKey } from "../../../../theme-engine/runtime-commerce";
import { fashionStoreLiveCapabilities } from "../../capability-matrix";
import { fashionStoreDestinations } from "../../destinations";
import { resolveFashionStoreEditorMedia } from "../../resources";

type HomeViewModel = Extract<PresentationViewModel, { kind: "home" }>;

const properties = defineProps<{
  brandName?: string;
  configuration?: HomeViewModel["shell"]["footer"];
  publishedRoutes?: readonly string[];
  resolveAsset: ThemeAssetResolver;
  sourceAsset: (sourcePath: string) => string;
}>();

const sourceInlineGap = " ";
const sourceAsset = (sourcePath: string) => properties.sourceAsset(sourcePath);
const highDensity = ref(false);
const liveMode = inject(liveCommerceModeKey, false);
const publicContact = computed(() =>
  liveMode ? properties.configuration?.publicContact : undefined,
);
const accountVisible = computed(() => !liveMode || fashionStoreLiveCapabilities.account);

onMounted(() => {
  highDensity.value = window.devicePixelRatio > 1;
});

function densityAsset(standardPath: string, highDensityPath: string): string {
  return sourceAsset(highDensity.value ? highDensityPath : standardPath);
}

function configuredLogo(): string | undefined {
  const logo = properties.configuration?.logo;
  return logo ? resolveFashionStoreEditorMedia(properties.resolveAsset, logo) : undefined;
}

const configuredBrandName = computed(
  () => properties.configuration?.logo?.alt.trim() || properties.brandName || "Lifestyle",
);

function routeHref(path: string): string | undefined {
  return properties.publishedRoutes && !properties.publishedRoutes.includes(path)
    ? undefined
    : path;
}

function fallbackLogo(): string {
  return densityAsset(
    "images/demo-fashion-store-logo-white.png",
    "images/demo-fashion-store-logo-white@2x.png",
  );
}

function fallbackLogoAt2x(): string {
  return sourceAsset("images/demo-fashion-store-logo-white@2x.png");
}
</script>

<template>
  <footer class="footer-dark bg-dark-gray p-0 fashion-store-footer-canonical">
    <div class="container">
      <div class="row align-items-center pt-35px pb-35px">
        <div class="col-12 col-md-auto sm-mb-15px text-center text-md-start">
          <a
            href="/"
            data-fashion-store-route
            class="footer-logo"
            :aria-label="`${configuredBrandName} home`"
            ><img
              :alt="configuration?.logo?.alt ?? ''"
              class="default-logo"
              v-bind:src="configuredLogo() ?? fallbackLogo()"
              v-bind:data-at2x="configuredLogo() ?? fallbackLogoAt2x()"
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
                :href="routeHref(fashionStoreRoutePaths['shop-left'])"
                data-fashion-store-route
                class="nav-link"
                >Shop</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a
                :href="routeHref(fashionStoreRoutePaths.collection)"
                data-fashion-store-route
                class="nav-link"
                >Collection</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a
                :href="routeHref(fashionStoreRoutePaths.magazine)"
                data-fashion-store-route
                class="nav-link"
                >Magazine</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a
                :href="routeHref(fashionStoreRoutePaths.about)"
                data-fashion-store-route
                class="nav-link"
                >About</a
              >
            </li>
            {{
              sourceInlineGap
            }}
            <li class="nav-item">
              <a
                :href="routeHref(fashionStoreRoutePaths.contact)"
                data-fashion-store-route
                class="nav-link"
                >Contact</a
              >
            </li>
          </ul>
        </div>
        <div
          v-if="
            configuration?.legalLink ||
            (!liveMode && (configuration?.contactCopy || configuration?.socialLink))
          "
          class="col-12 text-center text-md-end mt-15px"
        >
          <span v-if="!liveMode && configuration?.contactCopy" class="text-white me-15px">{{
            configuration.contactCopy
          }}</span>
          <a
            v-if="configuration.legalLink"
            :href="configuration.legalLink.href"
            data-fashion-store-route
            class="text-white me-15px"
            >{{ configuration.legalLink.label }}</a
          >
          <a
            v-if="!liveMode && configuration.socialLink"
            :href="configuration.socialLink.href"
            :target="
              configuration.socialLink.targetBehavior === 'new-window' ? '_blank' : undefined
            "
            :rel="
              configuration.socialLink.targetBehavior === 'new-window'
                ? 'noopener noreferrer'
                : undefined
            "
            class="text-white"
            >{{ configuration.socialLink.label }}</a
          >
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
            <li><a :href="undefined" data-fashion-store-route aria-disabled="true">Men</a></li>
            <li><a :href="undefined" data-fashion-store-route aria-disabled="true">Women</a></li>
            <li>
              <a :href="undefined" data-fashion-store-route aria-disabled="true">Accessories</a>
            </li>
            <li><a :href="undefined" data-fashion-store-route aria-disabled="true">Shoes</a></li>
            <li><a :href="undefined" data-fashion-store-route aria-disabled="true">Dresses</a></li>
          </ul>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Information</span>
          <ul>
            <li>
              <a :href="routeHref(fashionStoreRoutePaths.about)" data-fashion-store-route
                >About us</a
              >
            </li>
            <li>
              <a :href="routeHref(fashionStoreRoutePaths.contact)" data-fashion-store-route
                >Contact us</a
              >
            </li>
            <li>
              <a :href="routeHref('/policies/terms')" data-fashion-store-route
                >Terms &amp; conditions</a
              >
            </li>
            <li>
              <a :href="routeHref('/policies/shipping')" data-fashion-store-route
                >Shipping &amp; delivery</a
              >
            </li>
            <li>
              <a :href="routeHref('/policies/privacy')" data-fashion-store-route>Privacy policy</a>
            </li>
          </ul>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Quick links</span>
          <ul>
            <li>
              <a
                :href="accountVisible ? routeHref(fashionStoreRoutePaths.account) : undefined"
                :aria-disabled="!accountVisible || undefined"
                data-fashion-store-route
                >My account</a
              >
            </li>
            <li>
              <a :href="undefined" data-fashion-store-route aria-disabled="true">Orders tracking</a>
            </li>
            <li>
              <a :href="undefined" data-fashion-store-route aria-disabled="true">Our store</a>
            </li>
            <li>
              <a :href="undefined" data-fashion-store-route aria-disabled="true">Size guide</a>
            </li>
            <li>
              <a :href="routeHref(fashionStoreRoutePaths.faq)" data-fashion-store-route>FAQs</a>
            </li>
          </ul>
        </div>

        <div
          class="col-6 col-lg-3 col-md-4 col-sm-5 md-mb-50px xs-mb-30px order-sm-2 order-lg-2 offset-md-2 offset-lg-0"
        >
          <span class="fw-500 d-block text-white mb-10px fs-17">Quick contact</span>
          <div v-if="liveMode && publicContact?.publicPhone">
            <FashionStoreIcon name="phone-call" class="fs-16 text-white me-10px xs-me-5px" /><a
              :href="`tel:${publicContact.publicPhone}`"
              >{{ publicContact.publicPhone }}</a
            >
          </div>
          <div v-if="liveMode && publicContact?.supportEmail" class="mb-15px">
            <FashionStoreIcon name="mail" class="fs-16 text-white me-10px xs-me-5px" /><a
              :href="`mailto:${publicContact.supportEmail}`"
              class="text-decoration-line-bottom"
              >{{ publicContact.supportEmail }}</a
            >
          </div>
          <div v-if="liveMode && publicContact?.privacyEmail" class="mb-15px">
            Privacy:
            <a :href="`mailto:${publicContact.privacyEmail}`">{{ publicContact.privacyEmail }}</a>
          </div>
          <div v-if="liveMode && !publicContact" class="mb-15px">
            {{ configuration?.contactCopy || "Contact details are being prepared." }}
          </div>
          <div
            v-if="
              liveMode &&
              publicContact &&
              !publicContact.publicPhone &&
              !publicContact.supportEmail &&
              !publicContact.privacyEmail
            "
            class="mb-15px"
          >
            {{
              publicContact.locations.length
                ? "See Contact for location details."
                : publicContact.socials.length
                  ? "Connect through our published social links."
                  : "Contact details are being prepared."
            }}
          </div>
          <div v-if="!liveMode">
            <FashionStoreIcon name="phone-call" class="fs-16 text-white me-10px xs-me-5px" /><a
              :href="fashionStoreDestinations.phone"
              >123 456 7890</a
            >
          </div>
          <div v-if="!liveMode" class="mb-15px">
            <FashionStoreIcon name="mail" class="fs-16 text-white me-10px xs-me-5px" /><a
              :href="fashionStoreDestinations.supportEmail"
              class="text-decoration-line-bottom"
              >info@domain.com</a
            >
          </div>
          <span
            v-if="
              !liveMode ||
              publicContact?.socials.length ||
              (!publicContact && configuration?.socialLink)
            "
            class="fw-500 d-block text-white mb-5px fs-17"
            >Connect with us</span
          >
          <a
            v-if="liveMode && !publicContact && configuration?.socialLink"
            :href="configuration.socialLink.href"
            :target="
              configuration.socialLink.targetBehavior === 'new-window' ? '_blank' : undefined
            "
            :rel="
              configuration.socialLink.targetBehavior === 'new-window'
                ? 'noopener noreferrer'
                : undefined
            "
            >{{ configuration.socialLink.label }}</a
          >
          <ul
            v-if="publicContact?.socials.length"
            class="list-unstyled mb-15px"
            data-contact-social-links
          >
            <li v-for="social in publicContact.socials" :key="social.id">
              <a
                :href="social.url"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`${social.label} (opens in a new tab)`"
                >{{ social.label }}</a
              >
            </li>
          </ul>
          <div v-if="!liveMode" class="elements-social social-icon-style-02">
            <ul class="light">
              <li>
                <a
                  class="facebook"
                  :href="fashionStoreDestinations.facebook"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  ><FashionStoreIcon name="facebook"
                /></a>
              </li>
              {{
                sourceInlineGap
              }}
              <li>
                <a
                  class="dribbble"
                  :href="fashionStoreDestinations.dribbble"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Dribbble"
                  ><FashionStoreIcon name="dribbble"
                /></a>
              </li>
              {{
                sourceInlineGap
              }}
              <li>
                <a
                  class="twitter"
                  :href="fashionStoreDestinations.twitter"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter"
                  ><FashionStoreIcon name="twitter"
                /></a>
              </li>
              {{
                sourceInlineGap
              }}
              <li>
                <a
                  class="instagram"
                  :href="fashionStoreDestinations.instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  ><FashionStoreIcon name="instagram"
                /></a>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="col-lg-3 col-md-6 col-sm-7 ps-20px sm-ps-15px md-mb-50px xs-mb-0 order-sm-1 order-lg-5"
        >
          <span class="fw-500 d-block text-white mb-5px fs-17">Become a member</span>
          <div v-if="liveMode" class="mb-15px">Newsletter sign-up is currently unavailable.</div>
          <div v-else class="mb-15px">Join now and get 20% extra discount!</div>
          <div
            v-if="!liveMode"
            class="d-inline-block w-100 newsletter-style-04 position-relative mb-15px"
          >
            <form action="#" method="post" class="position-relative w-100" v-on:submit.prevent="">
              <input
                class="input-small bg-nero-grey border-radius-4px fs-14 border-color-transparent w-100 form-control pe-50px ps-20px lg-ps-15px required"
                type="email"
                name="email"
                placeholder="Enter your email"
              />
              <input type="hidden" name="redirect" value="" />
              <button class="btn pe-20px submit" aria-label="submit">
                <FashionStoreIcon name="mail" class="icon icon-small text-white" />
              </button>
              <div
                class="form-results border-radius-4px pt-5px pb-5px ps-15px pe-15px fs-14 lh-22 mt-10px w-100 text-center position-absolute d-none"
              ></div>
            </form>
          </div>
          <div v-if="!liveMode" class="footer-card">
            <a
              :href="undefined"
              data-fashion-store-route
              aria-disabled="true"
              class="d-inline-block me-5px align-middle"
              ><img
                alt="Visa payment information"
                v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-01.png')" /></a
            >{{ sourceInlineGap }}
            <a
              :href="undefined"
              data-fashion-store-route
              aria-disabled="true"
              class="d-inline-block me-5px align-middle"
              ><img
                alt="PayPal payment information"
                v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-02.png')" /></a
            >{{ sourceInlineGap }}
            <a
              :href="undefined"
              data-fashion-store-route
              aria-disabled="true"
              class="d-inline-block me-5px align-middle"
              ><img
                alt="Mastercard payment information"
                v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-03.png')" /></a
            >{{ sourceInlineGap }}
            <a
              :href="undefined"
              data-fashion-store-route
              aria-disabled="true"
              class="d-inline-block me-5px align-middle"
              ><img
                alt="American Express payment information"
                v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-04.png')"
            /></a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
:where(.fashion-store-footer-canonical) .container,
:where(.fashion-store-footer-canonical) .container-fluid,
:where(.fashion-store-footer-canonical) .container-lg,
:where(.fashion-store-footer-canonical) .container-md,
:where(.fashion-store-footer-canonical) .container-sm,
:where(.fashion-store-footer-canonical) .container-xl,
:where(.fashion-store-footer-canonical) .container-xxl {
  padding-right: 15px;
  padding-left: 15px;
}

:where(.fashion-store-footer-canonical) .row {
  margin-right: -15px;
  margin-left: -15px;
}

:where(.fashion-store-footer-canonical) .row > * {
  padding-right: 15px;
  padding-left: 15px;
}

ul a,
a[href^="tel:"],
a[href^="mailto:"],
.mb-15px,
.input-small,
.input-small::placeholder,
p,
.col-lg-5 > span {
  color: #a8a8a8 !important;
  opacity: 1;
}
</style>
