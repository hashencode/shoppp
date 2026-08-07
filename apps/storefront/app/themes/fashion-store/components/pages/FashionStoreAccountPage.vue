<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import { fashionStoreRoutePaths } from "../../page-contracts";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Account requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreContentData).account;
});
const remember = ref(false);
const loginSubmitCount = ref(0);
const registerSubmitCount = ref(0);

function submitLogin(): void {
  loginSubmitCount.value += 1;
}

function submitRegister(): void {
  registerSubmitCount.value += 1;
}
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-account
      data-runtime-status="ready"
      :data-login-submit-count="loginSubmitCount"
      :data-register-submit-count="registerSubmitCount"
    >
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container">
          <div class="row align-items-center justify-content-center">
            <div
              class="col-12 col-xl-8 col-lg-10 text-center position-relative page-title-extra-large"
            >
              <h1 class="alt-font fw-600 text-dark-gray mb-10px">My account</h1>
            </div>
            <nav
              class="col-12 breadcrumb breadcrumb-style-01 d-flex justify-content-center"
              aria-label="Breadcrumb"
            >
              <ul>
                <li><a :href="fashionStoreRoutePaths.home" data-fashion-store-route>Home</a></li>
                {{
                  " "
                }}
                <li>My account</li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <section class="pt-0 fashion-account-body">
        <div class="container">
          <div class="row g-0 justify-content-center fashion-account-forms">
            <div class="col-xl-4 col-lg-5 col-md-10 contact-form-style-04 md-mb-50px">
              <span class="fs-26 xs-fs-24 alt-font fw-600 text-dark-gray mb-20px d-block"
                >Member login</span
              >
              <form class="fashion-account-login" @submit.prevent="submitLogin">
                <label for="fashion-login-email" class="text-dark-gray mb-10px fw-500"
                  >Username or email address<span class="text-red">*</span></label
                >
                <input
                  id="fashion-login-email"
                  class="mb-20px bg-very-light-gray form-control"
                  type="email"
                  name="login-email"
                  placeholder="Enter your username"
                  autocomplete="username"
                  required
                />
                <label for="fashion-login-password" class="text-dark-gray mb-10px fw-500"
                  >Password<span class="text-red">*</span></label
                >
                <input
                  id="fashion-login-password"
                  class="mb-20px bg-very-light-gray form-control"
                  type="password"
                  name="login-password"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                />
                <div
                  class="position-relative terms-condition-box text-start d-flex align-items-center mb-20px"
                >
                  <label>
                    <input
                      v-model="remember"
                      type="checkbox"
                      name="remember"
                      class="terms-condition check-box align-middle"
                    />
                    <span class="box fs-14">Remember me</span>
                  </label>
                  <a
                    href="#"
                    class="fs-14 text-dark-gray fw-500 text-decoration-line-bottom ms-auto"
                    @click.prevent
                    >Forget your password?</a
                  >
                </div>
                <button
                  class="btn btn-medium btn-round-edge btn-dark-gray btn-box-shadow submit w-100"
                  type="submit"
                >
                  Login
                </button>
              </form>
            </div>

            <div
              class="col-lg-6 col-md-10 offset-xl-2 offset-lg-1 p-6 box-shadow-extra-large border-radius-6px fashion-account-register-panel"
            >
              <span class="fs-26 xs-fs-24 alt-font fw-600 text-dark-gray mb-20px d-block"
                >Create an account</span
              >
              <form class="fashion-account-register" @submit.prevent="submitRegister">
                <label for="fashion-register-name" class="text-dark-gray mb-10px fw-500"
                  >Username<span class="text-red">*</span></label
                >
                <input
                  id="fashion-register-name"
                  class="mb-20px bg-very-light-gray form-control"
                  name="register-name"
                  type="text"
                  placeholder="Enter your username"
                  autocomplete="username"
                  required
                />
                <label for="fashion-register-email" class="text-dark-gray mb-10px fw-500"
                  >Email address<span class="text-red">*</span></label
                >
                <input
                  id="fashion-register-email"
                  class="mb-20px bg-very-light-gray form-control"
                  type="email"
                  name="register-email"
                  placeholder="Enter your email"
                  autocomplete="email"
                  required
                />
                <label for="fashion-register-password" class="text-dark-gray mb-10px fw-500"
                  >Password<span class="text-red">*</span></label
                >
                <input
                  id="fashion-register-password"
                  class="mb-20px bg-very-light-gray form-control"
                  type="password"
                  name="register-password"
                  placeholder="Enter your password"
                  autocomplete="new-password"
                  required
                />
                <span class="fs-13 lh-22 w-90 lg-w-100 md-w-90 sm-w-100 d-block mb-30px"
                  >{{ data.privacyCopy.replace("privacy policy.", "")
                  }}<a
                    href="#"
                    class="text-dark-gray text-decoration-line-bottom fw-500"
                    @click.prevent
                    >privacy policy.</a
                  ></span
                >
                <button
                  class="btn btn-medium btn-round-edge btn-dark-gray btn-box-shadow submit w-100"
                  type="submit"
                >
                  Register
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
