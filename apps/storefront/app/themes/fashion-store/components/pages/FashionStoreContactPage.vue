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
const overlapContainer = ref<HTMLElement | null>(null);
const overlapMargin = ref("");
let overlapObserver: ResizeObserver | undefined;

function syncOverlapMargin(): void {
  const container = overlapContainer.value;
  const area = container?.firstElementChild;
  const section = container?.closest("section");
  if (!container || !area || !section || window.innerWidth <= 767) {
    overlapMargin.value = "";
    return;
  }
  const sectionPaddingTop = Number.parseFloat(getComputedStyle(section).paddingTop) || 0;
  overlapMargin.value = `${-(area.getBoundingClientRect().height / 4 + sectionPaddingTop)}px`;
}

onMounted(() => {
  syncOverlapMargin();
  const area = overlapContainer.value?.firstElementChild;
  if (area) {
    overlapObserver = new ResizeObserver(syncOverlapMargin);
    overlapObserver.observe(area);
  }
  window.addEventListener("resize", syncOverlapMargin);
});

onBeforeUnmount(() => {
  overlapObserver?.disconnect();
  window.removeEventListener("resize", syncOverlapMargin);
});

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
          <div class="row">
            <div class="col-xxl-5 col-xl-6 col-lg-6 md-mb-8 text-center text-sm-start">
              <div class="alt-font text-dark-gray mb-15px fs-20">
                <span class="text-highlight"
                  >Feel free to get in touch!<span class="bg-base-color h-8px bottom-0px"></span
                ></span>
              </div>
              <h2 class="alt-font text-dark-gray fw-400 ls-minus-1px">
                Call or visit us at different <span class="fw-600">locations.</span>
              </h2>
              <template v-for="(location, index) in data.locations" :key="location.city">
                <div class="fs-22 fw-700 text-dark-gray mb-10px">{{ location.city }}</div>
                <div
                  class="row row-cols-1 row-cols-sm-2"
                  :class="{ 'mb-10': index < data.locations.length - 1 }"
                >
                  <div class="col last-paragraph-no-margin xs-mb-20px">
                    <span class="fs-18 fw-600 d-block text-dark-gray">{{ location.name }}</span>
                    <p class="w-95 xl-w-100">
                      {{ location.address[0] }}<br />{{ location.address[1] }}
                    </p>
                  </div>
                  <div class="col">
                    <span class="fs-18 fw-600 d-block text-dark-gray">Get in touch</span>
                    <a :href="`tel:${location.phone.replace(/\s/g, '')}`">{{ location.phone }}</a
                    ><br />
                    <a
                      :href="`mailto:${location.email}`"
                      class="text-decoration-line-bottom text-dark-gray"
                      >{{ location.email }}</a
                    >
                  </div>
                </div>
              </template>
            </div>
            <div class="col-xxl-6 offset-xxl-1 col-lg-6">
              <div
                class="fashion-contact-map outside-box-right-30 position-relative"
                role="img"
                aria-label="Map showing London and New York store markers"
              >
                <img :src="sourceAsset('images/demo-fashion-store-contatc-01.png')" alt="" />
                <span
                  class="fashion-contact-marker fashion-contact-marker-london"
                  aria-hidden="true"
                  ><span class="fashion-contact-marker-core"
                    ><i class="fa-solid fa-location-dot"></i></span
                ></span>
                <span
                  class="fashion-contact-marker fashion-contact-marker-new-york"
                  aria-hidden="true"
                  ><span class="fashion-contact-marker-core"
                    ><i class="fa-solid fa-location-dot"></i></span
                ></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="h-600px md-h-500px sm-h-400px section-dark fashion-contact-parallax"
        data-parallax-background-ratio="0.5"
        :style="{
          backgroundImage: `url(${sourceAsset('images/demo-fashion-store-contatc-02.jpg')})`,
        }"
        aria-label="Fashion store interior"
      ></section>

      <section class="position-relative sm-pt-20px fashion-contact-form">
        <div
          ref="overlapContainer"
          class="container overlap-section overlap-section-three-fourth"
          :style="{ marginTop: overlapMargin }"
        >
          <div class="row row-cols-md-1 justify-content-center">
            <div class="col-xl-10">
              <div
                class="bg-white pt-8 pb-8 box-shadow-double-large ps-10 pe-10 border-radius-6px sm-pe-5 sm-ps-5"
              >
                <div class="row mb-2">
                  <div class="col-10">
                    <h2 class="alt-font text-dark-gray ls-minus-2px">
                      How we can
                      <span class="text-highlight fw-600"
                        >help<span class="bg-base-color h-5px bottom-2px"></span
                      ></span>
                      you?
                    </h2>
                  </div>
                  <div class="col-2 text-end">
                    <i class="bi bi-send icon-large text-dark-gray animation-float"></i>
                  </div>
                </div>
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
                      <div class="position-relative form-group mb-25px">
                        <span class="form-icon"><i class="bi bi-emoji-smile"></i></span>
                        <input
                          id="fashion-contact-name"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          type="text"
                          name="name"
                          placeholder="What's your good name?"
                          required
                        />
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label
                        for="fashion-contact-email"
                        class="form-label fw-600 text-dark-gray mb-0"
                        >Email address*</label
                      >
                      <div class="position-relative form-group mb-25px">
                        <span class="form-icon"><i class="bi bi-envelope"></i></span>
                        <input
                          id="fashion-contact-email"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          type="email"
                          name="email"
                          placeholder="Enter your email address"
                          required
                        />
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label
                        for="fashion-contact-phone"
                        class="form-label fw-600 text-dark-gray mb-0"
                        >Phone number*</label
                      >
                      <div class="position-relative form-group mb-25px">
                        <span class="form-icon"><i class="bi bi-telephone"></i></span>
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
                    </div>
                    <div class="col-md-6">
                      <label
                        for="fashion-contact-subject"
                        class="form-label fw-600 text-dark-gray mb-0"
                        >Subject</label
                      >
                      <div class="position-relative form-group mb-25px">
                        <span class="form-icon"><i class="bi bi-journals"></i></span>
                        <input
                          id="fashion-contact-subject"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          type="text"
                          name="subject"
                          placeholder="How can we help you?"
                        />
                      </div>
                    </div>
                    <div class="col-12 mb-4">
                      <label
                        for="fashion-contact-message"
                        class="form-label fw-600 text-dark-gray mb-0"
                        >Your message</label
                      >
                      <div class="position-relative form-group form-textarea mb-0">
                        <textarea
                          id="fashion-contact-message"
                          class="ps-0 border-radius-0px border-color-extra-medium-gray bg-transparent form-control"
                          name="comment"
                          placeholder="Describe about your project"
                          rows="4"
                        ></textarea>
                        <span class="form-icon"><i class="bi bi-chat-square-dots"></i></span>
                      </div>
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
      </section>
    </main>
  </FashionStoreShell>
</template>
