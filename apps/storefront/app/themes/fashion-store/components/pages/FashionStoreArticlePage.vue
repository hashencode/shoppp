<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreEditorialCard from "../shared/FashionStoreEditorialCard.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Article requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreContentData).article;
});
const localActionCount = ref(0);
const commentSubmitCount = ref(0);

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function recordLocalAction(): void {
  localActionCount.value += 1;
}

function submitComment(): void {
  commentSubmitCount.value += 1;
}
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    body-class=""
    :preload-image="sourceAsset(data.media[0]!)"
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-article
      data-runtime-status="ready"
      :data-comment-submit-count="commentSubmitCount"
      :data-local-action-count="localActionCount"
    >
      <article>
        <section class="top-space-margin half-section bg-gradient-very-light-gray">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-10 text-center">
                <span class="fs-18 mb-30px d-inline-block sm-mb-20px"
                  >By
                  <a
                    href="#"
                    class="text-dark-gray text-decoration-line-bottom"
                    @click.prevent="recordLocalAction"
                    >{{ data.lead.author }}</a
                  >
                  in
                  <a
                    href="#"
                    class="text-dark-gray text-decoration-line-bottom"
                    @click.prevent="recordLocalAction"
                    >{{ data.lead.category }}</a
                  >
                  on {{ data.lead.date }}</span
                >
                <h1 class="alt-font fw-600 text-dark-gray ls-minus-2px mb-0">
                  {{ data.lead.title }}
                </h1>
              </div>
            </div>
          </div>
        </section>

        <section class="py-0 ps-13 pe-13 lg-ps-4 lg-pe-4 sm-px-0 fashion-article-media">
          <div class="container-fluid">
            <div class="row justify-content-center">
              <div class="col-12">
                <img :src="sourceAsset(data.media[0]!)" class="w-100" alt="" />
              </div>
            </div>
          </div>
        </section>

        <section class="fashion-article-body">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-10">
                <div class="row">
                  <aside class="col-lg-3 col-md-4 text-center sm-mb-30px">
                    <div class="pb-20px">
                      <img
                        :src="sourceAsset('images/blog-single-creative-avtar.jpg')"
                        class="rounded-circle w-130px mb-20px"
                        alt=""
                      />
                      <span class="d-block lh-22">Words by</span
                      ><a
                        :href="fashionStoreRoutePaths.magazine"
                        class="text-dark-gray alt-font fw-500 text-uppercase"
                        data-fashion-store-route
                        >Jackson smith</a
                      >
                    </div>
                    <div class="h-3px w-100 bg-dark-gray mb-20px"></div>
                    <ul class="d-flex list-unstyled justify-content-center">
                      <li class="me-25px">
                        <a href="#comments" class="text-uppercase alt-font fs-13"
                          ><i
                            class="feather icon-feather-message-circle me-5px icon-small align-middle"
                          ></i
                          >Comment</a
                        >
                      </li>
                      <li>
                        <button
                          type="button"
                          class="fashion-article-like text-uppercase alt-font fs-13"
                          @click="recordLocalAction"
                        >
                          <i class="feather icon-feather-heart me-5px icon-small align-middle"></i
                          >Like
                        </button>
                      </li>
                    </ul>
                  </aside>
                  <div
                    class="offset-lg-1 col-md-8 last-paragraph-no-margin text-center text-md-start"
                  >
                    <h3 class="alt-font fw-600 text-dark-gray">
                      Make performance analysis an ongoing strategy.
                    </h3>
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                      incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                      nostrud exercitation ullamco laboris nisi ut aliquip commodo consequat. Duis
                      aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                      fugiat nulla pariatur.
                    </p>
                    <p>
                      Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
                      doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo
                      <span class="text-dark-gray text-decoration-line-bottom"
                        >inventore veritatis et quasi</span
                      >
                      architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia
                      voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni
                      dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                      qui dolorem ipsum quia.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          class="py-0 ps-13 pe-13 lg-ps-4 lg-pe-4 sm-px-0 fashion-article-media fashion-article-media-secondary"
        >
          <div class="container-fluid">
            <div class="row justify-content-center">
              <div class="col-12">
                <img :src="sourceAsset(data.media[1]!)" class="w-100" alt="" />
              </div>
            </div>
          </div>
        </section>

        <section class="fashion-article-quote">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-10">
                <div class="row">
                  <div class="col-lg-3 col-md-4 text-center text-lg-end sm-mb-30px">
                    <img
                      :src="sourceAsset('images/blog-single-creative-08.png')"
                      class="mt-10px"
                      alt=""
                    />
                  </div>
                  <div
                    class="offset-lg-1 col-md-8 last-paragraph-no-margin text-center text-md-start"
                  >
                    <div class="pb-35px text-center text-md-start">
                      <h5 class="text-dark-gray fw-500 w-90 md-w-100 alt-font">
                        The artist's world is limitless. It can be found any where far from where he
                        lives or a few feet away.
                      </h5>
                      <span class="fw-600 text-dark-gray d-block lh-20 text-uppercase"
                        >Nicholas Robinson</span
                      ><span class="d-block text-uppercase fs-13">Founder of photos</span>
                    </div>
                    <div class="h-3px w-100 bg-dark-gray mb-35px"></div>
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                      incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                      nostrud exercitation ullamco laboris nisi ut aliquip commodo consequat.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          class="py-0 ps-13 pe-13 lg-ps-4 lg-pe-4 sm-px-0 fashion-article-media fashion-article-media-secondary"
        >
          <div class="container-fluid">
            <div class="row justify-content-center">
              <div class="col-12">
                <img :src="sourceAsset(data.media[2]!)" class="w-100" alt="" />
              </div>
            </div>
          </div>
        </section>

        <section class="fashion-article-conclusion">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-10">
                <div class="row">
                  <div class="col-lg-3 col-md-4 text-center text-md-start">
                    <h5 class="alt-font fw-600 text-dark-gray">
                      Look for opportunities to diversify.
                    </h5>
                  </div>
                  <div
                    class="offset-lg-1 col-md-8 last-paragraph-no-margin text-center text-md-start"
                  >
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                      incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                      nostrud exercitation ullamco laboris nisi ut aliquip commodo consequat.
                    </p>
                    <p>
                      Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
                      doloremque laudantium
                      <span class="text-dark-gray text-decoration-line-bottom"
                        >totam rem aperiam</span
                      >
                      eaque ipsa quae ab illo inventore veritatis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="half-section pt-0 fashion-article-author-share">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-10">
                <div class="row mb-30px">
                  <div class="tag-cloud col-md-9 text-center text-md-start sm-mb-15px">
                    <template
                      v-for="tag in ['Development', 'Event', 'Multimedia', 'Fashion']"
                      :key="tag"
                    >
                      <a :href="fashionStoreRoutePaths.magazine" data-fashion-store-route>{{
                        tag
                      }}</a
                      >{{ " " }}
                    </template>
                  </div>
                  <div class="tag-cloud col-md-3 text-uppercase text-center text-md-end">
                    <button
                      type="button"
                      class="likes-count fw-500 mx-0"
                      @click="recordLocalAction"
                    >
                      <i class="fa-regular fa-heart text-red me-10px"></i
                      ><span class="text-dark-gray text-dark-gray-hover">05 Likes</span>
                    </button>
                  </div>
                </div>
                <div class="row">
                  <div class="col-12 mb-6">
                    <div
                      class="d-block d-md-flex w-100 box-shadow-extra-large align-items-center border-radius-4px p-7 sm-p-35px"
                    >
                      <div class="w-140px text-center me-50px sm-mx-auto">
                        <img
                          :src="sourceAsset(data.author.sourceImage)"
                          class="rounded-circle w-120px"
                          alt=""
                        /><a
                          :href="fashionStoreRoutePaths.magazine"
                          class="text-dark-gray fw-500 mt-20px d-inline-block lh-20"
                          data-fashion-store-route
                          >{{ data.author.name }}</a
                        ><span class="fs-15 lh-20 d-block sm-mb-15px">{{ data.author.role }}</span>
                      </div>
                      <div class="w-75 sm-w-100 text-center text-md-start last-paragraph-no-margin">
                        <p>{{ data.author.bio }}</p>
                        <a
                          :href="fashionStoreRoutePaths.magazine"
                          class="btn btn-link btn-large text-dark-gray mt-15px"
                          data-fashion-store-route
                          >All author posts</a
                        >
                      </div>
                    </div>
                  </div>
                </div>
                <div class="row justify-content-center">
                  <div
                    class="col-12 text-center elements-social social-icon-style-04 fashion-article-share"
                  >
                    <ul class="large-icon dark">
                      <template v-for="share in data.shareLinks" :key="share.label">
                        <li>
                          <a
                            :class="share.label.toLowerCase()"
                            :href="share.href"
                            target="_blank"
                            rel="noopener noreferrer"
                            :aria-label="`Share on ${share.label}`"
                            ><i class="fa-brands" :class="`fa-${share.icon}`"></i><span></span
                          ></a>
                        </li>
                        {{ " " }}
                      </template>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="bg-very-light-gray fashion-article-related">
          <div class="container">
            <div class="row mb-6 xs-mb-7">
              <div class="col-12 text-center">
                <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
                  Related
                  <span class="text-highlight fw-600"
                    >posts<span class="bg-base-color h-5px bottom-2px"></span
                  ></span>
                </h2>
              </div>
            </div>
            <div class="row">
              <div class="col-12">
                <ul
                  class="blog-classic blog-wrapper grid grid-3col xl-grid-3col lg-grid-3col md-grid-2col sm-grid-2col xs-grid-1col gutter-extra-large"
                >
                  <li class="grid-sizer" aria-hidden="true"></li>
                  <FashionStoreEditorialCard
                    v-for="post in data.related"
                    :key="post.sourceImage"
                    :author="post.author"
                    :date="post.date"
                    :href="fashionStoreRoutePaths.article"
                    :image="sourceAsset(post.sourceImage)"
                    :title="post.title"
                  />
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section class="fashion-article-comments">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-9 text-center mb-2">
                <h6 class="alt-font text-dark-gray fw-500">4 Comments</h6>
              </div>
            </div>
            <div class="row justify-content-center">
              <div class="col-lg-9">
                <ul class="blog-comment">
                  <li
                    v-for="comment in data.comments"
                    :key="`${comment.author}-${comment.date}`"
                    :class="{ 'fashion-comment-child': comment.depth === 1 }"
                  >
                    <div
                      class="d-block d-md-flex w-100 align-items-center align-items-md-start"
                      :class="{
                        'border-radius-5px p-50px md-p-30px sm-p-20px bg-very-light-gray':
                          comment.author === 'Colene Landin',
                      }"
                    >
                      <div class="w-90px sm-w-65px sm-mb-10px">
                        <img
                          :src="sourceAsset(comment.sourceImage)"
                          class="rounded-circle"
                          alt=""
                        />
                      </div>
                      <div class="w-100 ps-30px last-paragraph-no-margin sm-ps-0">
                        <a
                          href="#"
                          class="text-dark-gray fw-500"
                          @click.prevent="recordLocalAction"
                          >{{ comment.author }}</a
                        ><a href="#comments" class="btn-reply text-uppercase section-link">Reply</a>
                        <div class="fs-14 lh-24 mb-10px">{{ comment.date }}</div>
                        <p class="w-85 sm-w-100">{{ comment.text }}</p>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="comments" class="pt-0 fashion-article-comment-form">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-9 mb-3 sm-mb-6">
                <h6 class="alt-font text-dark-gray fw-500 mb-5px">Write a comment</h6>
                <div class="mb-5px">
                  Your email address will not be published. Required fields are marked *
                </div>
              </div>
            </div>
            <div class="row justify-content-center">
              <div class="col-lg-9">
                <form class="row contact-form-style-02" @submit.prevent="submitComment">
                  <div class="col-md-6 mb-30px">
                    <input
                      id="fashion-comment-name"
                      aria-label="Name"
                      class="input-name border-radius-4px form-control"
                      type="text"
                      name="name"
                      placeholder="Enter your name*"
                      required
                    />
                  </div>
                  <div class="col-md-6 mb-30px">
                    <input
                      id="fashion-comment-email"
                      aria-label="Email address"
                      class="border-radius-4px form-control"
                      type="email"
                      name="email"
                      placeholder="Enter your email address*"
                      required
                    />
                  </div>
                  <div class="col-md-12 mb-30px">
                    <textarea
                      id="fashion-comment-message"
                      aria-label="Your message"
                      class="border-radius-4px form-control"
                      cols="40"
                      rows="4"
                      name="comment"
                      placeholder="Your message"
                    ></textarea>
                  </div>
                  <div class="col-12">
                    <button class="btn btn-dark-gray btn-small btn-round-edge submit" type="submit">
                      Post Comment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </article>
    </main>
  </FashionStoreShell>
</template>
