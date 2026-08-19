<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreFaqData } from "../../fixtures/pages/content";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";
defineProps<{ resolveAsset: ThemeAssetResolver }>();
const open = ref(0);
</script>
<template>
  <DecorStoreShell
    active-page="faq"
    :announcement="decorStoreFaqData.announcement"
    :resolve-asset="resolveAsset"
    ><DecorStorePageTitle breadcrumb="FAQs" title="FAQs" />
    <section class="pb-80px">
      <div class="container">
        <div
          v-for="(question, index) in decorStoreFaqData.questions"
          :key="question"
          class="border-bottom"
        >
          <h2 class="fs-18">
            <button
              type="button"
              class="w-100 text-start"
              :aria-expanded="open === index"
              :aria-controls="`decor-faq-${index}`"
              @click="open = open === index ? -1 : index"
            >
              {{ question }}
            </button>
          </h2>
          <p v-show="open === index" :id="`decor-faq-${index}`">{{ decorStoreFaqData.answer }}</p>
        </div>
      </div>
    </section></DecorStoreShell
  >
</template>
