<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { fashionSourceContract } from "../source-contract";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
</script>

<template>
  <div class="fashion-about-page">
    <section class="fashion-about-hero">
      <img
        :src="resolveAsset('fashion.slider-01')"
        alt="Lifestyle collection"
        width="1920"
        height="1080"
      />
      <div><span>10</span><strong>Years of experience</strong></div>
    </section>

    <section class="fashion-about-journey">
      <div class="fashion-page-kicker">The fashion core collection!</div>
      <h2>The journey of crafto lifestyle.</h2>
      <div>
        <p>
          Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has
          been the industry's standard dummy text ever since the 1500s, when an unknown printer took
          a galley of type.
        </p>
        <p>
          Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has
          been the industry's standard dummy text ever since the 1500s, when an unknown printer took
          a galley of type and scrambled it.
        </p>
      </div>
    </section>

    <section class="fashion-about-gallery" aria-label="Lifestyle editorial gallery">
      <img
        v-for="assetId in [
          'fashion.banner-01',
          'fashion.collection-slider-01',
          'fashion.banner-02',
          'fashion.collection-slider-02',
          'fashion.banner-03',
          'fashion.collection-slider-03',
        ]"
        :key="assetId"
        :src="resolveAsset(assetId)"
        alt=""
      />
    </section>

    <section class="fashion-about-timeline">
      <h2>We care our customers</h2>
      <ol>
        <li v-for="milestone in fashionSourceContract.aboutPage.milestones" :key="milestone[0]">
          <span>{{ milestone[0] }}</span
          ><strong>{{ milestone[1] }}</strong>
          <p>Lorem ipsum is simply text the printing typesetting standard dummy.</p>
        </li>
      </ol>
    </section>

    <section class="fashion-about-mission">
      <div class="fashion-about-review">
        <strong>Join the 10000+ people trusting us.</strong><span>★★★★★</span>
        <p>4.9 out of 5 - 8549 Total reviews.</p>
      </div>
      <p class="fashion-page-kicker">Our fashion store mission</p>
      <h2>Quality product with exceptional price-value.</h2>
      <div class="fashion-about-stories">
        <article v-for="story in fashionSourceContract.aboutPage.stories" :key="story[0]">
          <img :src="resolveAsset(story[1])" :alt="story[0]" width="600" height="765" />
          <div>
            <h3>{{ story[0] }}</h3>
            <p>
              We deliver customized marketing campaign to use your audience to make a positive move.
            </p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
