<script setup lang="ts">
import { Camera, Globe2, Heart, UsersRound } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  brand: string;
  brandAssetId?: string;
  columns: Record<string, string[]>;
  payments?: string[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed<Data | null>(() => {
  if (p.viewModel.kind === "theme-section") return p.viewModel.data as unknown as Data;
  if (p.viewModel.kind === "footer")
    return {
      brand: p.viewModel.brand,
      columns: { Information: p.viewModel.legalLinks.map(({ label }) => label) },
    };
  return null;
});
const socialMessage = ref("");

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
</script>
<template>
  <footer v-if="data" id="decor-footer" class="decor-footer">
    <div class="decor-footer-grid">
      <section id="decor-contact">
        <strong>
          <img
            v-if="data.brandAssetId"
            :src="p.resolveAsset(data.brandAssetId)"
            :alt="data.brand"
            width="167"
            height="36"
          />
          <template v-else><i></i>{{ data.brand }}</template>
        </strong>
        <p>Objects chosen to make everyday rooms feel personal.</p>
        <nav class="decor-footer-social" aria-label="Social channels">
          <button
            type="button"
            aria-label="Photo sharing"
            @click="socialMessage = 'Photo sharing is not connected in this preview.'"
          >
            <Camera aria-hidden="true" :size="17" :stroke-width="1.7" />
          </button>
          <button
            type="button"
            aria-label="Community"
            @click="socialMessage = 'Community is not connected in this preview.'"
          >
            <UsersRound aria-hidden="true" :size="17" :stroke-width="1.7" />
          </button>
          <button
            type="button"
            aria-label="Favorites"
            @click="socialMessage = 'Favorites are available in this preview session only.'"
          >
            <Heart aria-hidden="true" :size="17" :stroke-width="1.7" />
          </button>
          <button
            type="button"
            aria-label="Website"
            @click="socialMessage = 'This is the local preview website.'"
          >
            <Globe2 aria-hidden="true" :size="17" :stroke-width="1.7" />
          </button>
        </nav>
        <p class="decor-social-message" aria-live="polite">{{ socialMessage }}</p>
      </section>
      <section v-for="(links, heading) in data.columns" :key="heading">
        <h2>{{ heading }}</h2>
        <a v-for="link in links" :key="link" :href="destination(link)">{{ link }}</a>
      </section>
      <section>
        <h2>Newsletter</h2>
        <p>Get everything you need, succeeded.</p>
        <input type="email" aria-label="Email address" placeholder="Enter your email" />
        <div class="decor-payments">
          <img
            v-for="assetId in data.payments ?? []"
            :key="assetId"
            :src="p.resolveAsset(assetId)"
            alt="Payment method"
            width="64"
            height="36"
          />
        </div>
      </section>
    </div>
    <nav aria-label="Legal">
      <NuxtLink to="/policies/privacy">Privacy policy</NuxtLink
      ><NuxtLink to="/policies/terms">Terms of service</NuxtLink
      ><span>© 2026 {{ data.brand }}</span>
    </nav>
  </footer>
</template>
