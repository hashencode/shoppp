<script setup lang="ts">
defineProps<{ breadcrumb: string; title: string }>();
</script>

<template>
  <section class="page-title-center-alignment cover-background top-space-padding">
    <div class="container">
      <div class="row">
        <div class="col-12 text-center position-relative page-title-extra-large">
          <h1
            class="alt-font d-inline-block fw-700 ls-minus-05px text-base-color mb-10px mt-3 md-mt-50px"
          >
            {{ title }}
          </h1>
        </div>
        <div class="col-12 breadcrumb breadcrumb-style-01 d-flex justify-content-center">
          <ul>
            <li><a href="/" data-decor-store-route>Home</a></li>
            <li>{{ breadcrumb }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
