<script setup lang="ts">
defineProps<{ error: { statusCode?: number; statusMessage?: string } }>();
useSeoMeta({
  title: "Page not found | Shoppp",
  description: "The requested Shoppp page could not be found.",
  robots: "noindex, nofollow",
});
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <NuxtLink class="wordmark" to="/">SHOPPP</NuxtLink>
    </header>
    <main class="not-found">
      <strong aria-hidden="true">{{ error.statusCode ?? 404 }}</strong>
      <h1>Page not found</h1>
      <p>{{ error.statusMessage ?? "The requested page does not exist." }}</p>
      <NuxtLink class="cta" to="/">Return home</NuxtLink>
    </main>
  </div>
</template>
