<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  backgroundAssetId?: string;
  body?: string;
  brand: string;
  brandAssetId?: string;
  brandAsset2xId?: string;
  care?: readonly [string, string];
  columns: Record<string, readonly string[]>;
  copyright?: string;
  legal?: string;
  member?: { body: string; heading: string; placeholder: string };
  payments?: readonly string[];
  support?: readonly [string, string];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const cookieVisible = ref(false);
const newsletterEmail = ref("");
const newsletterMessage = ref("");
const stickyActions = ref<HTMLElement | null>(null);
const scrollProgressControl = ref<HTMLElement | null>(null);
let cookieTimer = 0;
let scrollFrame = 0;
let maximumScroll = 1;
let resizeObserver: ResizeObserver | undefined;
const data = computed<Data | null>(() => {
  if (p.viewModel.kind === "theme-section") return p.viewModel.data as unknown as Data;
  if (p.viewModel.kind === "footer")
    return {
      brand: p.viewModel.brand,
      columns: { Information: p.viewModel.legalLinks.map(({ label }) => label) },
    };
  return null;
});
function destination(label: string): string {
  const routes: Record<string, string> = {
    "About us": "/#decor-footer",
    "Contact us": "/#decor-contact",
    "My account": "/#decor-contact",
    Checkout: "/checkout",
    Orders: "/#decor-contact",
    Payment: "/policies/terms",
  };
  return routes[label] ?? "/#decor-categories";
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
  newsletterMessage.value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletterEmail.value)
    ? "Thanks for joining our newsletter."
    : "Please enter a valid email address.";
}
function updateScrollChrome(): void {
  scrollFrame = 0;
  const progress = Math.min(1, Math.max(0, window.scrollY / maximumScroll));
  const visible = String(window.scrollY > Math.min(500, window.innerHeight * 0.6));
  stickyActions.value?.setAttribute("data-visible", visible);
  scrollProgressControl.value?.setAttribute("data-visible", visible);
  scrollProgressControl.value?.setAttribute("data-progress", progress.toFixed(3));
  scrollProgressControl.value?.style.setProperty("--decor-scroll-progress", `${progress * 360}deg`);
}
function handleScroll(): void {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(updateScrollChrome);
}
function refreshScrollBounds(): void {
  maximumScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  handleScroll();
}
function returnToTop(): void {
  window.scrollTo({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    top: 0,
  });
}
onMounted(() => {
  cookieTimer = window.setTimeout(() => {
    cookieVisible.value = !hasCookieConsent();
  }, 1_000);
  refreshScrollBounds();
  resizeObserver = new ResizeObserver(refreshScrollBounds);
  resizeObserver.observe(document.documentElement);
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", refreshScrollBounds, { passive: true });
});
onBeforeUnmount(() => {
  clearTimeout(cookieTimer);
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  resizeObserver?.disconnect();
  window.removeEventListener("scroll", handleScroll);
  window.removeEventListener("resize", refreshScrollBounds);
});
</script>
<template>
  <footer
    v-if="data"
    id="decor-footer"
    class="decor-footer"
    :style="
      data.backgroundAssetId
        ? { backgroundImage: `url(${p.resolveAsset(data.backgroundAssetId)})` }
        : undefined
    "
  >
    <div class="decor-footer-grid">
      <section id="decor-contact" class="decor-footer-intro">
        <strong>
          <img
            v-if="data.brandAssetId"
            :src="p.resolveAsset(data.brandAssetId)"
            :srcset="
              data.brandAsset2xId
                ? `${p.resolveAsset(data.brandAssetId)} 1x, ${p.resolveAsset(data.brandAsset2xId)} 2x`
                : undefined
            "
            :alt="data.brand"
            width="167"
            height="36"
          />
          <template v-else>{{ data.brand }}</template>
        </strong>
        <p>{{ data.body }}</p>
        <nav class="decor-footer-social" aria-label="Social channels">
          <a href="https://www.facebook.com/" aria-label="Facebook">
            <i class="decor-brand-icon decor-brand-facebook" aria-hidden="true"></i>
          </a>
          <a href="https://dribbble.com/" aria-label="Dribbble">
            <i class="decor-brand-icon decor-brand-dribbble" aria-hidden="true"></i>
          </a>
          <a href="https://twitter.com/" aria-label="Twitter">
            <i class="decor-brand-icon decor-brand-twitter" aria-hidden="true"></i>
          </a>
          <a href="https://www.instagram.com/" aria-label="Instagram">
            <i class="decor-brand-icon decor-brand-instagram" aria-hidden="true"></i>
          </a>
        </nav>
      </section>
      <section v-for="(links, heading) in data.columns" :key="heading">
        <span class="decor-footer-heading">{{ heading }}</span>
        <ul class="decor-footer-links">
          <li v-for="link in links" :key="link">
            <a :href="destination(link)">{{ link }}</a>
          </li>
        </ul>
      </section>
      <section v-if="data.member" class="decor-footer-member">
        <span class="decor-footer-heading">{{ data.member.heading }}</span>
        <p>{{ data.member.body }}</p>
        <form class="decor-newsletter-form" novalidate @submit.prevent="submitNewsletter">
          <label
            ><span class="sr-only">Email address</span
            ><input v-model="newsletterEmail" type="email" :placeholder="data.member.placeholder"
          /></label>
          <button type="submit" aria-label="Submit newsletter email">
            <i class="decor-feather decor-feather-mail" aria-hidden="true"></i>
          </button>
        </form>
        <p v-if="newsletterMessage" class="decor-newsletter-message" aria-live="polite">
          {{ newsletterMessage }}
        </p>
        <div class="decor-payments" role="group" aria-label="Accepted payments">
          <img
            v-for="assetId in data.payments ?? []"
            :key="assetId"
            :src="p.resolveAsset(assetId)"
            alt=""
            width="64"
            height="36"
          />
        </div>
      </section>
    </div>
    <nav class="decor-legal" aria-label="Legal">
      <div class="decor-legal-copy">
        <p>
          This site is protected by reCAPTCHA and the Google
          <a href="/policies/privacy">privacy policy</a> and terms of service apply.
        </p>
        <p>
          © 2024 Crafto is Proudly Powered by
          <a href="https://www.themezaa.com/" target="_blank" rel="noreferrer">ThemeZaa</a>
        </p>
      </div>
      <p v-if="data.support">
        <small>{{ data.support[0] }}</small
        ><a :href="`tel:${data.support[1].replace(/\s/g, '')}`">{{ data.support[1] }}</a>
      </p>
      <p v-if="data.care">
        <small>{{ data.care[0] }}</small
        ><a :href="`mailto:${data.care[1]}`">{{ data.care[1] }}</a>
      </p>
    </nav>
  </footer>
  <aside v-if="cookieVisible" class="decor-cookie-message" aria-label="Cookie notice">
    <p>
      We use cookies to enhance your browsing experience, serve personalized ads or content, and
      analyze our traffic. By clicking "Allow cookies" you consent to our use of cookies.
    </p>
    <a href="/policies/privacy">Cookie policy</a>
    <button type="button" @click="acceptCookies">Allow cookies</button>
  </aside>
  <aside
    ref="stickyActions"
    class="decor-sticky-actions"
    aria-label="Theme actions"
    data-visible="false"
  >
    <a href="/#decor-footer">Demos</a><a href="/#decor-products">Buy theme</a>
  </aside>
  <a
    ref="scrollProgressControl"
    class="decor-scroll-progress"
    href="#preview-content"
    aria-label="Back to top"
    data-visible="false"
    data-progress="0.000"
    style="--decor-scroll-progress: 0deg"
    @click.prevent="returnToTop"
    >↑</a
  >
</template>
