<script setup lang="ts">
import FashionStoreIcon from "./FashionStoreIcon.vue";
import { fashionStoreRoutePaths } from "../../page-contracts";

withDefaults(defineProps<{ breadcrumbLabel?: string; title: string }>(), {
  breadcrumbLabel: undefined,
});

const sourceInlineGap = " ";
</script>

<template>
  <section class="top-space-margin half-section bg-gradient-very-light-gray">
    <div class="container">
      <div class="row align-items-center justify-content-center">
        <div class="col-12 col-xl-8 col-lg-10 text-center position-relative page-title-extra-large">
          <h1 class="alt-font fw-600 text-dark-gray mb-10px">{{ title }}</h1>
        </div>
        <div class="col-12 breadcrumb breadcrumb-style-01 d-flex justify-content-center">
          <ul>
            <li>
              <a :href="fashionStoreRoutePaths.home" data-fashion-store-route>Home</a
              ><FashionStoreIcon name="chevron-right" class="fashion-breadcrumb-separator" />
            </li>
            {{
              sourceInlineGap
            }}
            <li>{{ breadcrumbLabel ?? title }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
