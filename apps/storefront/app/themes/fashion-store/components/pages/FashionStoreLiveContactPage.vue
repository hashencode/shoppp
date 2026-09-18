<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { resolveFashionStoreEditorMedia } from "../../resources";
import FashionStorePageTitle from "../shared/FashionStorePageTitle.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

type ContactPresentation = Extract<PresentationViewModel, { kind: "state" }>;

const properties = defineProps<{
  presentation: ContactPresentation;
  resolveAsset: ThemeAssetResolver;
}>();

const contact = computed(() => properties.presentation.publicContact);
const mediaSource = computed(() =>
  properties.presentation.media
    ? resolveFashionStoreEditorMedia(properties.resolveAsset, properties.presentation.media)
    : undefined,
);
const hasGeneralDetails = computed(() =>
  Boolean(
    contact.value?.supportEmail ||
    contact.value?.privacyEmail ||
    contact.value?.publicPhone ||
    (properties.presentation.state === "populated" && contact.value?.serviceHours),
  ),
);
</script>

<template>
  <FashionStoreShell :resolve-asset="resolveAsset">
    <main
      id="fashion-store-main"
      data-fashion-store-contact-live
      :data-content-state="presentation.state"
      :data-contact-version="presentation.contactVersion"
    >
      <FashionStorePageTitle :title="presentation.heading" />
      <section class="pt-0 pb-60px sm-pb-40px">
        <div class="container">
          <div class="row align-items-center gy-4">
            <div class="col-lg-7">
              <p class="alt-font fs-22 text-dark-gray mb-0">
                {{ presentation.message }}
              </p>
            </div>
            <div v-if="presentation.media && mediaSource" class="col-lg-5">
              <img
                :src="mediaSource"
                :alt="presentation.media.alt"
                :width="presentation.media.width"
                :height="presentation.media.height"
                class="w-100 border-radius-6px"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="hasGeneralDetails"
        class="pt-0 pb-60px sm-pb-40px"
        aria-labelledby="contact-channels-heading"
      >
        <div class="container">
          <h2 id="contact-channels-heading" class="alt-font text-dark-gray fw-600 fs-28 mb-25px">
            Contact details
          </h2>
          <div class="row row-cols-1 row-cols-md-2 g-4">
            <div v-if="contact?.supportEmail" class="col" data-contact-channel="support-email">
              <span class="d-block fw-600 text-dark-gray">Customer support</span>
              <a :href="`mailto:${contact.supportEmail}`">{{ contact.supportEmail }}</a>
            </div>
            <div v-if="contact?.privacyEmail" class="col" data-contact-channel="privacy-email">
              <span class="d-block fw-600 text-dark-gray">Privacy inquiries</span>
              <a :href="`mailto:${contact.privacyEmail}`">{{ contact.privacyEmail }}</a>
            </div>
            <div v-if="contact?.publicPhone" class="col" data-contact-channel="phone">
              <span class="d-block fw-600 text-dark-gray">Phone</span>
              <a :href="`tel:${contact.publicPhone}`">{{ contact.publicPhone }}</a>
            </div>
          </div>
          <p v-if="contact?.serviceHours && contact.timeZone" class="mt-25px mb-0">
            Service hours: {{ contact.serviceHours }} ({{ contact.timeZone }})
          </p>
        </div>
      </section>

      <section
        v-if="contact?.locations.length"
        class="pt-0 pb-60px sm-pb-40px"
        aria-labelledby="contact-locations-heading"
      >
        <div class="container">
          <h2 id="contact-locations-heading" class="alt-font text-dark-gray fw-600 fs-28 mb-25px">
            Locations
          </h2>
          <div class="row row-cols-1 row-cols-md-2 g-4">
            <article
              v-for="location in contact.locations"
              :key="location.id"
              class="col"
              data-fashion-store-location
            >
              <div class="h-100 border p-4 border-radius-6px">
                <h3 class="alt-font text-dark-gray fw-600 fs-22 mb-5px">{{ location.name }}</h3>
                <p class="mb-10px">{{ location.city }}</p>
                <address class="mb-15px" style="white-space: pre-line">
                  {{ location.address }}
                </address>
                <div v-if="location.phone">
                  <a :href="`tel:${location.phone}`">{{ location.phone }}</a>
                </div>
                <div v-if="location.email">
                  <a :href="`mailto:${location.email}`">{{ location.email }}</a>
                </div>
                <a
                  v-if="location.mapUrl"
                  :href="location.mapUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="`View map for ${location.name} (opens in a new tab)`"
                  class="d-inline-block mt-15px text-decoration-line-bottom"
                  >View map</a
                >
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        v-if="contact?.socials.length"
        class="pt-0 pb-70px"
        aria-labelledby="contact-social-heading"
      >
        <div class="container">
          <h2 id="contact-social-heading" class="alt-font text-dark-gray fw-600 fs-28 mb-25px">
            Connect with us
          </h2>
          <ul class="d-flex flex-wrap gap-20px list-unstyled mb-0">
            <li v-for="social in contact.socials" :key="social.id">
              <a
                :href="social.url"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`${social.label} (opens in a new tab)`"
              >
                {{ social.label }}
              </a>
            </li>
          </ul>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
