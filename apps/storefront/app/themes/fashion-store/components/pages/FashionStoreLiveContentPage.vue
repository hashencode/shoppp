<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

type StateViewModel = Extract<PresentationViewModel, { kind: "state" }>;

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: StateViewModel;
}>();
</script>

<template>
  <FashionStoreShell
    announcement="Published storefront information"
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-live-content
      :data-content-state="viewModel.state"
    >
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container text-center">
          <h1 class="alt-font fw-600 text-dark-gray mb-15px">{{ viewModel.heading }}</h1>
          <p
            class="mx-auto mb-25px"
            :role="viewModel.state === 'unavailable' ? 'status' : undefined"
          >
            {{ viewModel.message }}
          </p>
          <div class="d-flex gap-15px justify-content-center flex-wrap">
            <a
              v-if="viewModel.action?.target"
              :href="viewModel.action.target"
              data-fashion-store-route
              class="btn btn-dark-gray btn-medium btn-round-edge"
            >
              {{ viewModel.action.label }}
            </a>
            <a href="/" data-fashion-store-route class="btn btn-transparent-dark-gray btn-medium">
              Return home
            </a>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
