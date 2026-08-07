<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import { fashionStoreAssetId } from "../../resources";
import FashionStorePageTitle from "../shared/FashionStorePageTitle.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Contact requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreContentData).contact;
});
const submitCount = ref(0);

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function recordLocalSubmission(event: Event): void {
  const form = event.currentTarget as HTMLFormElement;
  const invalid = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(":invalid");
  if (invalid) {
    invalid.focus();
    invalid.reportValidity();
    return;
  }
  submitCount.value += 1;
}
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    body-class=""
    :preload-image="sourceAsset('images/demo-fashion-store-contatc-01.png')"
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-contact
      data-runtime-status="ready"
      :data-contact-submit-count="submitCount"
    >
      <FashionStorePageTitle title="Contact" />
      <section class="pt-0 position-relative overflow-hidden fashion-contact-locations">
        <div class="container">
          <div class="row align-items-center">
            <div class="col-xxl-5 col-lg-6 md-mb-50px">
              <div class="alt-font text-dark-gray mb-15px fs-20">
                <span class="text-highlight">Feel free to get in touch!</span>
              </div>
              <h2 class="alt-font text-dark-gray fw-400 ls-minus-1px">
                Call or visit us at different <span class="fw-600">locations.</span>
              </h2>
              <div class="row">
                <div
                  v-for="location in data.locations"
                  :key="location.city"
                  class="col-sm-6 last-paragraph-no-margin"
                >
                  <span class="alt-font fs-18 fw-600 text-dark-gray d-block mb-5px">{{
                    location.city
                  }}</span>
                  <p>
                    <strong>{{ location.name }}</strong
                    ><br />{{ location.address[0] }}<br />{{ location.address[1] }}
                  </p>
                  <span class="alt-font fs-13 fw-600 text-dark-gray text-uppercase d-block mt-15px"
                    >Get in touch</span
                  >
                  <a :href="`tel:${location.phone.replace(/\s/g, '')}`">{{ location.phone }}</a
                  ><br />
                  <a
                    :href="`mailto:${location.email}`"
                    class="text-decoration-line-bottom text-dark-gray"
                    >{{ location.email }}</a
                  >
                </div>
              </div>
            </div>
            <div class="col-xxl-6 offset-xxl-1 col-lg-6">
              <div
                class="fashion-contact-map position-relative"
                role="img"
                aria-label="Map showing London and New York store markers"
              >
                <img :src="sourceAsset('images/demo-fashion-store-contatc-01.png')" alt="" />
                <span
                  class="fashion-contact-marker fashion-contact-marker-london"
                  aria-hidden="true"
                  ><i class="fa-solid fa-location-dot"></i
                ></span>
                <span
                  class="fashion-contact-marker fashion-contact-marker-new-york"
                  aria-hidden="true"
                  ><i class="fa-solid fa-location-dot"></i
                ></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="h-600px md-h-500px sm-h-400px section-dark fashion-contact-parallax"
        :style="{
          backgroundImage: `url(${sourceAsset('images/demo-fashion-store-contatc-02.jpg')})`,
        }"
        aria-label="Fashion store interior"
      ></section>

      <section class="position-relative sm-pt-20px fashion-contact-form">
        <div class="container">
          <div class="row justify-content-center">
            <div class="col-lg-10">
              <div class="row align-items-center">
                <div class="col-md-5 sm-mb-30px text-center text-md-start">
                  <h2 class="alt-font text-dark-gray ls-minus-2px">
                    How we can <span class="text-highlight fw-600">help</span> you?
                  </h2>
                </div>
                <div class="col-md-7">
                  <form
                    class="contact-form-style-03"
                    novalidate
                    @submit.prevent="recordLocalSubmission"
                  >
                    <div class="row">
                      <div class="col-md-6">
                        <label
                          for="fashion-contact-name"
                          class="form-label fw-600 text-dark-gray mb-0"
                          >Enter your name*</label
                        >
                        <input
                          id="fashion-contact-name"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          type="text"
                          name="name"
                          placeholder="What's your good name?"
                          required
                        />
                      </div>
                      <div class="col-md-6">
                        <label
                          for="fashion-contact-email"
                          class="form-label fw-600 text-dark-gray mb-0"
                          >Email address*</label
                        >
                        <input
                          id="fashion-contact-email"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          type="email"
                          name="email"
                          placeholder="Enter your email address"
                          required
                        />
                      </div>
                      <div class="col-md-6">
                        <label
                          for="fashion-contact-phone"
                          class="form-label fw-600 text-dark-gray mb-0"
                          >Phone number*</label
                        >
                        <input
                          id="fashion-contact-phone"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          type="tel"
                          name="phone"
                          placeholder="Enter your phone number"
                          pattern="[0-9+\(\) ]{7,}"
                          required
                        />
                      </div>
                      <div class="col-md-6">
                        <label
                          for="fashion-contact-subject"
                          class="form-label fw-600 text-dark-gray mb-0"
                          >Subject</label
                        >
                        <input
                          id="fashion-contact-subject"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          type="text"
                          name="subject"
                          placeholder="How can we help you?"
                        />
                      </div>
                      <div class="col-12 mb-4">
                        <label
                          for="fashion-contact-message"
                          class="form-label fw-600 text-dark-gray mb-0"
                          >Your message</label
                        >
                        <textarea
                          id="fashion-contact-message"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          name="comment"
                          placeholder="Describe about your project"
                          rows="4"
                        ></textarea>
                      </div>
                      <div class="col-md-6">
                        <p class="mb-0 fs-14 lh-24 text-center text-md-start">
                          {{ data.privacyCopy }}
                        </p>
                      </div>
                      <div class="col-md-6 text-center text-md-end sm-mt-25px">
                        <button
                          class="btn btn-very-small btn-dark-gray btn-box-shadow btn-round-edge text-transform-none primary-font"
                          type="submit"
                        >
                          Send message
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
