<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";

defineProps<FashionStoreHomeSectionProperties>();
</script>

<template>
  <section class="p-15px bg-dark-gray text-white" data-home-section="promotion">
    <div class="container">
      <div class="row">
        <div class="col-12 text-center">
          <span class="fs-15 text-uppercase fw-500"
            >Take an extra 25% discount our favorite dress style. Use code:<span
              class="fs-14 fw-700 lh-28 alt-font text-dark-gray text-uppercase bg-base-color d-inline-block border-radius-30px ps-15px pe-15px ms-5px align-middle"
              >fw205</span
            ></span
          >
        </div>
      </div>
    </div>
  </section>
</template>
