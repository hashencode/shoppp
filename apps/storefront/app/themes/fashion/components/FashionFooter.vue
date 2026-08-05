<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface FooterData {
  brand: string;
  brandAssetId?: string;
  brandAsset2xId?: string;
  columns: Record<string, string[]>;
  contact?: { email: string; phone: string; socialHeading: string };
  copyright?: string;
  legal?: string;
  member?: { body: string; heading: string; placeholder: string };
  payments?: string[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const cookieVisible = ref(false);
const scrollProgress = ref(0);
const scrollProgressVisible = ref(false);
const newsletterEmail = ref("");
const newsletterMessage = ref("");
const newsletterInput = useTemplateRef<HTMLInputElement>("newsletterInput");
let cookieTimer = 0;
let progressFrame = 0;
let scrollFrame = 0;
const data = computed<FooterData | null>(() => {
  if (properties.viewModel.kind === "theme-section")
    return properties.viewModel.data as unknown as FooterData;
  if (properties.viewModel.kind === "footer")
    return {
      brand: properties.viewModel.brand,
      columns: { Information: properties.viewModel.legalLinks.map(({ label }) => label) },
    };
  return null;
});

function destination(label: string): string {
  const routes: Record<string, string> = {
    "About us": "/about",
    "Contact us": "/contact",
    FAQs: "/faq",
    "My account": "/account",
    "Orders tracking": "/orders/access",
    "Our store": "/contact",
    "Privacy policy": "/policies/privacy",
    "Shipping & delivery": "/policies/shipping",
    "Terms & conditions": "/policies/terms",
  };
  return routes[label] ?? "/#fashion-categories";
}

function hasCookieConsent(): boolean {
  return document.cookie
    .split(";")
    .some((entry) => entry.trim().startsWith("cookieConsent=closed"));
}

function acceptCookies(): void {
  document.cookie = "cookieConsent=closed; max-age=86400; path=/; SameSite=Lax";
  cookieVisible.value = false;
}

function submitNewsletter(): void {
  if (!newsletterInput.value?.checkValidity()) {
    newsletterMessage.value = "Please enter a valid email address.";
    newsletterInput.value?.focus();
    return;
  }
  newsletterMessage.value = "Thanks — your email is ready for this preview membership.";
}

function measureScrollProgress(): void {
  progressFrame = 0;
  const scrollTop = document.documentElement.scrollTop;
  const maxScrollTop =
    document.documentElement.scrollHeight - document.documentElement.clientHeight - 200;
  scrollProgressVisible.value = scrollTop > 200;
  scrollProgress.value = Math.min(100, Math.max(0, (scrollTop / Math.max(1, maxScrollTop)) * 100));
}

function requestProgressMeasurement(): void {
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(measureScrollProgress);
}

function scrollToTop(event: MouseEvent): void {
  event.preventDefault();
  cancelAnimationFrame(scrollFrame);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const origin = window.scrollY;
  const duration = reducedMotion ? 0 : 800;
  if (!duration) {
    window.scrollTo(0, 0);
    return;
  }
  const startedAt = performance.now();
  const step = (now: number): void => {
    const elapsed = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - elapsed) * (1 - elapsed);
    window.scrollTo(0, Math.round(origin * (1 - eased)));
    if (elapsed < 1) scrollFrame = requestAnimationFrame(step);
  };
  scrollFrame = requestAnimationFrame(step);
}

onMounted(() => {
  cookieTimer = window.setTimeout(() => {
    cookieVisible.value = !hasCookieConsent();
  }, 1_000);
  measureScrollProgress();
  window.addEventListener("scroll", requestProgressMeasurement, { passive: true });
  window.addEventListener("resize", requestProgressMeasurement);
});

onBeforeUnmount(() => {
  clearTimeout(cookieTimer);
  cancelAnimationFrame(progressFrame);
  cancelAnimationFrame(scrollFrame);
  window.removeEventListener("scroll", requestProgressMeasurement);
  window.removeEventListener("resize", requestProgressMeasurement);
});
</script>
<template>
  <footer v-if="data" id="fashion-footer" class="fashion-footer">
    <div class="fashion-footer-top">
      <strong>
        <img
          v-if="data.brandAssetId"
          :src="properties.resolveAsset(data.brandAssetId)"
          :srcset="
            data.brandAsset2xId
              ? `${properties.resolveAsset(data.brandAssetId)} 1x, ${properties.resolveAsset(data.brandAsset2xId)} 2x`
              : undefined
          "
          :alt="data.brand"
          width="155"
          height="34"
        />
        <template v-else><span>ML</span>{{ data.brand }}</template>
      </strong>
      <nav aria-label="Footer">
        <a href="/">Home</a><a href="/collections/all">Shop</a
        ><a href="/collections/new-arrivals">Collection</a><a href="/magazine">Magazine</a
        ><a href="/about">About</a><a href="/contact">Contact</a>
      </nav>
    </div>
    <div class="fashion-footer-grid">
      <section v-for="(links, heading) in data.columns" :key="heading">
        <h2>{{ heading }}</h2>
        <a v-for="link in links" :key="link" :href="destination(link)">{{ link }}</a>
      </section>
      <section v-if="data.contact" id="fashion-contact" class="fashion-footer-contact">
        <h2>Quick contact</h2>
        <div class="fashion-footer-contact-row">
          <span class="fashion-feather-icon fashion-feather-phone-call" aria-hidden="true" />
          <a :href="`tel:${data.contact.phone.replaceAll(' ', '')}`">{{ data.contact.phone }}</a>
        </div>
        <div class="fashion-footer-contact-row fashion-footer-contact-email">
          <span class="fashion-feather-icon fashion-feather-mail" aria-hidden="true" />
          <a :href="`mailto:${data.contact.email}`">{{ data.contact.email }}</a>
        </div>
        <h2>{{ data.contact.socialHeading }}</h2>
        <p class="fashion-footer-socials" aria-label="Social channels">
          <a href="https://www.facebook.com/" aria-label="Facebook">
            <span class="fashion-brand-icon fashion-brand-facebook" aria-hidden="true" />
          </a>
          <a href="https://dribbble.com/" aria-label="Dribbble">
            <span class="fashion-brand-icon fashion-brand-dribbble" aria-hidden="true" />
          </a>
          <a href="https://twitter.com/" aria-label="Twitter">
            <span class="fashion-brand-icon fashion-brand-twitter" aria-hidden="true" />
          </a>
          <a href="https://www.instagram.com/" aria-label="Instagram">
            <span class="fashion-brand-icon fashion-brand-instagram" aria-hidden="true" />
          </a>
        </p>
      </section>
      <section v-if="data.member" class="fashion-footer-member">
        <h2>{{ data.member.heading }}</h2>
        <p>{{ data.member.body }}</p>
        <form class="fashion-newsletter-form" novalidate @submit.prevent="submitNewsletter">
          <label
            ><span class="sr-only">Email address</span
            ><input
              ref="newsletterInput"
              v-model="newsletterEmail"
              required
              type="email"
              :placeholder="data.member.placeholder"
          /></label>
          <button type="submit" aria-label="Submit membership email">
            <span class="fashion-bootstrap-icon fashion-bootstrap-envelope" aria-hidden="true" />
          </button>
        </form>
        <p v-if="newsletterMessage" class="fashion-newsletter-message" aria-live="polite">
          {{ newsletterMessage }}
        </p>
        <div
          v-if="data.payments"
          class="fashion-footer-payments"
          role="group"
          aria-label="Accepted payments"
        >
          <img
            v-for="assetId in data.payments"
            :key="assetId"
            :src="properties.resolveAsset(assetId)"
            alt=""
            loading="lazy"
          />
        </div>
      </section>
    </div>
    <nav class="fashion-legal" aria-label="Legal">
      <p>
        This site is protected by reCAPTCHA and the Google
        <a href="/policies/privacy">privacy policy</a> and
        <a href="/policies/terms">terms of service.</a>
      </p>
      <span
        >© 2024 Crafto is Proudly Powered by
        <a href="https://www.themezaa.com/" target="_blank" rel="noreferrer">ThemeZaa</a></span
      >
    </nav>
  </footer>
  <aside v-if="cookieVisible" class="fashion-cookie-message" aria-label="Cookie notice">
    <p>
      We use cookies to enhance your browsing experience, serve personalized ads or content, and
      analyze our traffic. By clicking "Allow cookies" you consent to our use of cookies.
    </p>
    <a href="/policies/privacy">Cookie policy</a>
    <button type="button" @click="acceptCookies">Allow cookies</button>
  </aside>
  <aside
    class="fashion-scroll-progress"
    :class="{ visible: scrollProgressVisible }"
    :data-scroll-progress="scrollProgress.toFixed(2)"
  >
    <a href="#preview-content" aria-label="Back to top" @click="scrollToTop">
      <span class="fashion-scroll-text" aria-hidden="true">Scroll</span>
      <span class="fashion-scroll-line" aria-hidden="true">
        <span class="fashion-scroll-point" :style="{ height: `${scrollProgress}%` }"></span>
      </span>
    </a>
  </aside>
</template>
