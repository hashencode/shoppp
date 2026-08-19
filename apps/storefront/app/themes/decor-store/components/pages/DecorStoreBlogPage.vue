<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreBlogData } from "../../fixtures/pages/content";
import { decorStoreRoutePaths } from "../../page-contracts";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
</script>

<template>
  <DecorStoreShell
    active-page="blog"
    :announcement="decorStoreBlogData.announcement"
    :resolve-asset="resolveAsset"
    ><DecorStorePageTitle breadcrumb="blog" title="Latest blog" />
    <section class="pb-80px">
      <div class="container">
        <ul class="row row-cols-1 row-cols-md-2 row-cols-lg-3 list-unstyled">
          <li v-for="post in decorStoreBlogData.posts" :key="post.id" class="col mb-40px">
            <span>{{ post.category }} · {{ post.date }}</span>
            <h2 class="fs-18">
              <a :href="decorStoreRoutePaths.article" data-decor-store-route>{{ post.title }}</a>
            </h2>
          </li>
        </ul>
      </div>
    </section></DecorStoreShell
  >
</template>
