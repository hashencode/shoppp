<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface FooterData { brand: string; columns: Record<string, string[]> }
const properties = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed<FooterData | null>(() => {
  if (properties.viewModel.kind === "theme-section") return properties.viewModel.data as unknown as FooterData;
  if (properties.viewModel.kind === "footer") return {
    brand: properties.viewModel.brand,
    columns: { Information: properties.viewModel.legalLinks.map(({ label }) => label) },
  };
  return null;
});
</script>
<template><footer v-if="data" class="fashion-footer"><div class="fashion-footer-top"><strong><span>ML</span>{{ data.brand }}</strong><nav aria-label="Footer"><a href="/">Home</a><a href="#fashion-products">Shop</a><a href="#fashion-categories">Collection</a><a href="#fashion-products">Magazine</a></nav></div><div class="fashion-footer-grid"><section v-for="(links, heading) in data.columns" :key="heading"><h2>{{ heading }}</h2><a v-for="link in links" :key="link" href="#">{{ link }}</a></section><section><h2>Become a member</h2><p>Join now and get 20% extra discount.</p><label><span class="sr-only">Email address</span><input type="email" placeholder="Enter your email" /></label></section></div><nav aria-label="Legal" class="fashion-legal"><NuxtLink to="/policies/privacy">Privacy policy</NuxtLink><NuxtLink to="/policies/terms">Terms of service</NuxtLink><span>© 2026 Mode / Life</span></nav></footer></template>
