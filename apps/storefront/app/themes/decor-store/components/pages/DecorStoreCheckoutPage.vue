<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreCheckoutData } from "../../fixtures/pages/commerce";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
</script>

<template>
  <DecorStoreShell
    active-page="checkout"
    :announcement="decorStoreCheckoutData.announcement"
    :resolve-asset="resolveAsset"
  >
    <DecorStorePageTitle breadcrumb="checkout" title="Checkout" />
    <section class="pb-80px">
      <div class="container">
        <form aria-label="Checkout presentation" @submit.prevent>
          <div class="row">
            <div class="col-lg-7">
              <h2>Billing details</h2>
              <div class="row">
                <label class="col-sm-6">First name <input type="text" autocomplete="off" /></label
                ><label class="col-sm-6">Last name <input type="text" autocomplete="off" /></label>
              </div>
              <label>Company name (optional) <input type="text" autocomplete="off" /></label
              ><label
                >Country
                <select>
                  <option v-for="country in decorStoreCheckoutData.countries" :key="country">
                    {{ country }}
                  </option>
                </select></label
              ><label>Email address <input type="email" autocomplete="off" /></label
              ><label
                >Account password
                <input type="password" disabled aria-describedby="checkout-secret-note"
              /></label>
              <p id="checkout-secret-note">Password entry is unavailable in this presentation.</p>
            </div>
            <div class="col-lg-4 offset-lg-1">
              <h2>Your order</h2>
              <p>Table clock × 1 <strong>$23.00</strong></p>
              <p>Total <strong>$28.00</strong></p>
              <fieldset>
                <legend>Payment</legend>
                <label v-for="method in decorStoreCheckoutData.paymentMethods" :key="method"
                  ><input type="radio" disabled /> {{ method }}</label
                >
              </fieldset>
              <p>Payment and order submission are unavailable.</p>
              <button type="submit" disabled>Place order</button>
            </div>
          </div>
        </form>
      </div>
    </section>
  </DecorStoreShell>
</template>
