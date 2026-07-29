<script setup lang="ts">
setResponseStatus(404);
useSeoMeta({
  title: "Page not found | Shoppp",
  description: "The requested Shoppp page could not be found.",
  robots: "noindex, nofollow",
});
</script>

<template>
  <section class="not-found">
    <strong aria-hidden="true">404</strong>
    <h1>Page not found</h1>
    <p>The object you were looking for has moved or no longer exists.</p>
    <NuxtLink class="cta" to="/">Return home</NuxtLink>
  </section>
</template>
