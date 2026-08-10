<script setup lang="ts">
import { fashionSourceContract } from "../source-contract";

const selectedCategory = ref<(typeof fashionSourceContract.faqPage.categories)[number]>(
  fashionSourceContract.faqPage.categories[0],
);
</script>

<template>
  <section class="fashion-faq-page">
    <nav aria-label="FAQ categories">
      <button
        v-for="category in fashionSourceContract.faqPage.categories"
        :key="category"
        type="button"
        :class="{ 'is-active': category === selectedCategory }"
        @click="selectedCategory = category"
      >
        {{ category }}
      </button>
    </nav>
    <div class="fashion-faq-list">
      <details
        v-for="(question, index) in fashionSourceContract.faqPage.questions"
        :key="question"
        :open="index === 0"
      >
        <summary>{{ question }}</summary>
        <p>
          Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has
          been the industry's standard dummy text ever since the 1500s, when an unknown printer took
          a galley of type and scrambled it to make type.
        </p>
      </details>
    </div>
  </section>
</template>
