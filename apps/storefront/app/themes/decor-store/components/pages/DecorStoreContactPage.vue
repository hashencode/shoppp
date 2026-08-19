<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreContactData } from "../../fixtures/pages/content";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";
defineProps<{ resolveAsset: ThemeAssetResolver }>();
</script>
<template>
  <DecorStoreShell
    active-page="contact"
    :announcement="decorStoreContactData.announcement"
    :resolve-asset="resolveAsset"
    ><DecorStorePageTitle breadcrumb="contact us" title="Contact us" />
    <section class="pb-80px">
      <div class="container">
        <ul>
          <li v-for="detail in decorStoreContactData.details" :key="detail">{{ detail }}</li>
        </ul>
        <div role="img" aria-label="Store location map presentation" class="bg-light-gray p-40px">
          Store location
        </div>
        <form aria-label="Contact presentation" class="mt-40px" @submit.prevent>
          <label>Name <input type="text" autocomplete="off" /></label
          ><label>Email <input type="email" autocomplete="off" /></label
          ><label>Message <textarea></textarea></label
          ><button type="submit" disabled>Send message</button>
        </form>
      </div>
    </section></DecorStoreShell
  >
</template>
