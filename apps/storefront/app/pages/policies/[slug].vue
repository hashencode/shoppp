<script setup lang="ts">
import { catalogRelease } from "~/generated/catalog";
import { activeExperienceProviderInput } from "~/generated/active-experience";
import { canonicalUrl } from "~/utils/seo";
import { storefrontPlatformPresentationKey } from "~/theme-engine/presentation-context";

const route = useRoute();
const platformPresentation = inject(storefrontPlatformPresentationKey, undefined);
const presentation = computed(() =>
  platformPresentation?.value?.kind === "policy-presentation"
    ? platformPresentation.value
    : undefined,
);
const policyCatalogRelease =
  activeExperienceProviderInput.mode === "live"
    ? activeExperienceProviderInput.release
    : catalogRelease;
const policy = policyCatalogRelease.policies.find((item) => item.slug === route.params.slug);
if (!policy) throw createError({ statusCode: 404, statusMessage: "Policy not found" });
const canonical = canonicalUrl(policyCatalogRelease.site.origin, `/policies/${policy.slug}`);
useSeoMeta({
  title: `${policy.title} | ${policyCatalogRelease.site.name}`,
  description: policy.description,
  ogTitle: `${policy.title} | ${policyCatalogRelease.site.name}`,
  ogDescription: policy.description,
  ogUrl: canonical,
});
useHead({ link: [{ rel: "canonical", href: canonical }] });
</script>

<template>
  <article id="fashion-store-main" class="section">
    <p class="eyebrow">Customer information</p>
    <h1>{{ policy.title }}</h1>
    <aside v-if="presentation" data-policy-presentation>
      <p v-if="presentation.helpCopy">{{ presentation.helpCopy }}</p>
      <nav aria-label="Related policy information">
        <a
          v-if="presentation.documentLink"
          :href="presentation.documentLink.href"
          :target="
            presentation.documentLink.targetBehavior === 'new-window' ? '_blank' : undefined
          "
          :rel="
            presentation.documentLink.targetBehavior === 'new-window'
              ? 'noopener noreferrer'
              : undefined
          "
          data-policy-presentation-document-link
        >{{ presentation.documentLink.label }}</a>
        <a
          v-if="presentation.relatedLink"
          :href="presentation.relatedLink.href"
          :target="
            presentation.relatedLink.targetBehavior === 'new-window' ? '_blank' : undefined
          "
          :rel="
            presentation.relatedLink.targetBehavior === 'new-window'
              ? 'noopener noreferrer'
              : undefined
          "
          data-policy-presentation-related-link
        >{{ presentation.relatedLink.label }}</a>
      </nav>
    </aside>
    <div class="prose">
      <p>{{ policy.description }}</p>
      <p><strong>Effective date:</strong> {{ policy.effectiveDate }}</p>
      <section v-for="section in policy.sections" :key="section.heading">
        <h2>{{ section.heading }}</h2>
        <p>{{ section.body }}</p>
      </section>
    </div>
  </article>
</template>
