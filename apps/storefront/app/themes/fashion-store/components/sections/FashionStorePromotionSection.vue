<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import { resolveFashionStoreHomeFoundation } from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const promotion = computed(
  () => resolveFashionStoreHomeFoundation(properties.viewModel, properties.instance).promotion,
);
</script>

<template>
  <section class="p-15px bg-dark-gray text-white" data-home-section="promotion">
    <div class="container">
      <div class="row">
        <div class="col-12 text-center">
          <span class="fs-15 text-uppercase fw-500"
            >{{ promotion.message
            }}<span
              v-if="promotion.kind === 'badge'"
              class="fs-14 fw-700 lh-28 alt-font text-dark-gray text-uppercase bg-base-color d-inline-block border-radius-30px ps-15px pe-15px ms-5px align-middle"
              >{{ promotion.badge }}</span
            ><a
              v-else-if="promotion.href"
              :href="promotion.href"
              :data-resource-id="promotion.resourceId"
              data-fashion-store-route
              class="text-white text-decoration-line-bottom ms-5px"
              >{{ promotion.label }}</a
            ><span v-else class="ms-5px">{{ promotion.label }}</span></span
          >
        </div>
      </div>
    </div>
  </section>
</template>
