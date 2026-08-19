<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreAccountData } from "../../fixtures/pages/commerce";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
</script>

<template>
  <DecorStoreShell
    active-page="account"
    :announcement="decorStoreAccountData.announcement"
    :resolve-asset="resolveAsset"
  >
    <DecorStorePageTitle breadcrumb="my account" :title="decorStoreAccountData.title" />
    <section class="pb-80px">
      <div class="container">
        <div class="row">
          <form class="col-lg-5" aria-label="Login presentation" @submit.prevent>
            <h2>Login</h2>
            <label>Username or email address <input type="email" autocomplete="off" /></label
            ><label
              >Password <input type="password" disabled aria-describedby="account-secret-note"
            /></label>
            <p id="account-secret-note">Password entry is unavailable in this presentation.</p>
            <button type="submit" disabled>Login</button>
          </form>
          <form class="col-lg-5 offset-lg-2" aria-label="Registration presentation" @submit.prevent>
            <h2>Register</h2>
            <label>Email address <input type="email" autocomplete="off" /></label
            ><label>Password <input type="password" disabled /></label
            ><button type="submit" disabled>Register</button>
          </form>
        </div>
      </div>
    </section>
  </DecorStoreShell>
</template>
