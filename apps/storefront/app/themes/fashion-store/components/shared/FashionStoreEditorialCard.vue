<script setup lang="ts">
defineProps<{
  author: string;
  date: string;
  href: string;
  image: string;
  title: string;
}>();
</script>

<template>
  <li class="grid-item">
    <article class="card bg-transparent border-0 h-100">
      <div class="blog-image position-relative overflow-hidden">
        <a :href="href" data-fashion-store-route><img :src="image" alt="" /></a>
      </div>
      <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
        <span class="mb-5px d-block"
          >By <span class="text-dark-gray fw-500 categories-text">{{ author }}</span
          ><span class="blog-date">{{ date }}</span></span
        >
        <a
          :href="href"
          class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
          data-fashion-store-route
          >{{ title }}</a
        >
      </div>
    </article>
  </li>
</template>
