<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { fashionSourceContract } from "../source-contract";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
const emit = defineEmits<{ submit: [label: string] }>();

const comments = [
  ["Herman Miller", "17 July 2020, 6:05 PM"],
  ["Wilbur Haddock", "18 July 2020, 10:19 PM"],
  ["Colene Landin", "18 July 2020, 12:39 PM"],
  ["Jennifer Freeman", "19 July 2020, 8:25 PM"],
] as const;
</script>

<template>
  <article class="fashion-article-page">
    <header class="fashion-article-hero">
      <p>By <strong>Jackson</strong> in <strong>Marketing</strong> on 26 November 2021</p>
      <h2>Marketing tips and tricks for your creative website.</h2>
    </header>
    <img
      class="fashion-article-wide-image"
      :src="resolveAsset('fashion.blog-01')"
      alt="Creative fashion editorial"
      width="1410"
      height="850"
    />
    <section class="fashion-article-copy">
      <aside><strong>Words by Jackson smith</strong><span>Comment</span><span>Like</span></aside>
      <div>
        <h3>Make performance analysis an ongoing strategy.</h3>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip commodo consequat.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
          laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.
        </p>
      </div>
    </section>
    <img
      class="fashion-article-wide-image"
      :src="resolveAsset('fashion.blog-02')"
      alt="Fashion editorial detail"
      width="1410"
      height="850"
    />
    <blockquote>
      <p>
        The artist's world is limitless. It can be found anywhere, far from where he lives or a few
        feet away.
      </p>
      <cite>Nicholas Robinson · Founder of photos</cite>
    </blockquote>
    <section class="fashion-article-copy fashion-article-copy-single">
      <div>
        <h3>Look for opportunities to diversify.</h3>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris.
        </p>
      </div>
    </section>
    <footer class="fashion-article-author">
      <div>
        <span>Development</span><span>Event</span><span>Multimedia</span><span>Fashion</span>
      </div>
      <p>05 Likes</p>
      <section>
        <strong>Colene Landin</strong><span>Co-founder</span>
        <p>Lorem ipsum is simply dummy text of the printing and typesetting industry.</p>
        <button type="button">All author posts</button>
      </section>
    </footer>
    <section class="fashion-article-related">
      <h3>Related posts</h3>
      <div>
        <article v-for="item in fashionSourceContract.magazine.slice(0, 3)" :key="item[3]">
          <img :src="resolveAsset(item[0])" :alt="item[3]" />
          <p>
            By {{ item[1] }} <span>{{ item[2] }}</span>
          </p>
          <h4>{{ item[3] }}</h4>
        </article>
      </div>
    </section>
    <section class="fashion-article-comments">
      <h3>4 Comments</h3>
      <article v-for="comment in comments" :key="comment[0]">
        <strong>{{ comment[0] }}</strong
        ><a href="#fashion-comment-form">Reply</a><time>{{ comment[1] }}</time>
        <p>
          Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has
          been the industry's standard dummy text.
        </p>
      </article>
    </section>
    <section id="fashion-comment-form" class="fashion-article-comment-form">
      <h3>Write a comment</h3>
      <p>Your email address will not be published. Required fields are marked *</p>
      <form @submit.prevent="emit('submit', 'Comment')">
        <input required placeholder="Enter your name*" /><input
          required
          type="email"
          placeholder="Enter your email address*"
        /><textarea rows="4" placeholder="Your message" /><button type="submit">
          Post Comment
        </button>
      </form>
    </section>
  </article>
</template>
