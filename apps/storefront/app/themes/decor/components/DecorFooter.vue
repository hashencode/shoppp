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
          <a href="#" aria-label="Photo sharing"
            ><Camera aria-hidden="true" :size="17" :stroke-width="1.7"
          /></a>
          <a href="#" aria-label="Community"
            ><UsersRound aria-hidden="true" :size="17" :stroke-width="1.7"
          /></a>
          <a href="#" aria-label="Favorites"
            ><Heart aria-hidden="true" :size="17" :stroke-width="1.7"
          /></a>
          <a href="#" aria-label="Website"
            ><Globe2 aria-hidden="true" :size="17" :stroke-width="1.7"
          /></a>
        </nav>
      </section>
      <section v-for="(links, heading) in data.columns" :key="heading">
        <h2>{{ heading }}</h2>
        <a v-for="link in links" :key="link" href="#">{{ link }}</a>
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
