<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { fashionSourceContract } from "../source-contract";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
const emit = defineEmits<{ submit: [label: string] }>();
</script>

<template>
  <div class="fashion-contact-page">
    <section class="fashion-contact-locations">
      <div class="fashion-contact-intro">
        <p class="fashion-page-kicker">Feel free to get in touch!</p>
        <h2>Call or visit us at different locations.</h2>
      </div>
      <article
        v-for="(location, index) in fashionSourceContract.contactPage.locations"
        :key="location.city"
      >
        <img
          :src="
            resolveAsset(
              index === 0 ? 'fashion.collection-slider-01' : 'fashion.collection-slider-03',
            )
          "
          :alt="location.city"
          width="600"
          height="455"
        />
        <div>
          <h3>{{ location.city }}</h3>
          <strong>{{ location.country }}</strong>
          <address>{{ location.address }}</address>
          <span>Get in touch</span><a href="tel:+12345678910">+1 234 567 8910</a
          ><a href="mailto:info@domain.com">info@domain.com</a>
        </div>
      </article>
    </section>

    <section
      class="fashion-contact-visual"
      :style="{ backgroundImage: `url(${resolveAsset('fashion.slider-03')})` }"
      aria-label="Lifestyle store location"
    />

    <section class="fashion-contact-form-section">
      <div>
        <p class="fashion-page-kicker">Get in touch with us</p>
        <h2>How we can help you?</h2>
      </div>
      <form @submit.prevent="emit('submit', 'Contact request')">
        <label
          ><span>Enter your name*</span
          ><input required name="name" placeholder="What's your good name?"
        /></label>
        <label
          ><span>Email address*</span
          ><input required type="email" name="email" placeholder="Enter your email address"
        /></label>
        <label
          ><span>Phone number*</span
          ><input required type="tel" name="phone" placeholder="Enter your phone number"
        /></label>
        <label
          ><span>Subject</span><input name="subject" placeholder="How can we help you?"
        /></label>
        <label class="fashion-contact-message"
          ><span>Your message</span
          ><textarea rows="4" name="comment" placeholder="Describe about your project" />
        </label>
        <p>
          We are committed to protecting your privacy. We will never collect information about you
          without your explicit consent.
        </p>
        <button type="submit">Send message</button>
      </form>
    </section>
  </div>
</template>
