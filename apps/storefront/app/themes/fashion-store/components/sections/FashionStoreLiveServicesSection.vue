<script setup lang="ts">
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";
import { fashionStoreHomeServices as services } from "./home-content";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";

defineProps<FashionStoreHomeSectionProperties>();
</script>

<template>
  <section data-home-section="services" class="half-section">
    <div class="container">
      <div class="row row-cols-1 row-cols-md-2 row-cols-lg-4">
        <div v-for="service in services" :key="service[0]" class="col md-mb-30px">
          <div class="feature-box d-flex align-items-center">
            <FashionStoreIcon :name="service[2]" class="me-15px fs-28" />
            <div>
              <p class="alt-font fw-600 text-dark-gray mb-0">{{ service[0] }}</p>
              <p class="mb-0 text-dark-gray">{{ service[1] }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
