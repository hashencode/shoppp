<script setup lang="ts">
import { catalogRelease } from "~/generated/catalog";
import { canonicalUrl } from "~/utils/seo";

const route = useRoute();
const policy = catalogRelease.policies.find((item) => item.slug === route.params.slug);
if (!policy) throw createError({ statusCode: 404, statusMessage: "Policy not found" });
const canonical = canonicalUrl(catalogRelease.site.origin, `/policies/${policy.slug}`);
useSeoMeta({
  title: `${policy.title} | ${catalogRelease.site.name}`,
  description: policy.description,
  ogTitle: `${policy.title} | ${catalogRelease.site.name}`,
  ogDescription: policy.description,
  ogUrl: canonical,
});
useHead({ link: [{ rel: "canonical", href: canonical }] });
</script>

<template>
  <article class="section">
    <p class="eyebrow">Customer information</p>
    <h1>{{ policy.title }}</h1>
    <div class="prose">
      <p>{{ policy.description }}</p>
      <p>
        This launch policy is published from the approved commerce release. Market-specific
        eligibility is confirmed before checkout.
      </p>
    </div>
  </article>
</template>
