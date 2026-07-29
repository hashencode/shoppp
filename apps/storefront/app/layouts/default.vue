<script setup lang="ts">
import { catalogRelease } from "~/generated/catalog";
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <NuxtLink class="wordmark" to="/" aria-label="Shoppp home">SHOPPP</NuxtLink>
      <nav aria-label="Primary navigation">
        <NuxtLink
          v-for="collection in catalogRelease.collections"
          :key="collection.slug"
          :to="`/collections/${collection.slug}`"
        >
          {{ collection.name }}
        </NuxtLink>
        <NuxtLink to="/policies/shipping">Shipping</NuxtLink>
      </nav>
      <NuxtLink class="bag-link" to="/cart" aria-label="View shopping bag">Bag · 0</NuxtLink>
    </header>
    <main id="main-content" tabindex="-1">
      <slot />
    </main>
    <footer class="site-footer">
      <div>
        <p class="wordmark">SHOPPP</p>
        <p>Objects for moving thoughtfully through the world.</p>
      </div>
      <nav aria-label="Policies">
        <NuxtLink
          v-for="policy in catalogRelease.policies"
          :key="policy.slug"
          :to="`/policies/${policy.slug}`"
        >
          {{ policy.title }}
        </NuxtLink>
      </nav>
      <p>Catalog facts refreshed within {{ catalogRelease.site.freshnessHours }} hours.</p>
    </footer>
  </div>
</template>
