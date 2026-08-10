<script setup lang="ts">
import { recordPreviewIntent } from "../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { fashionSourceContract } from "../source-contract";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const checkout = computed(() =>
  properties.viewModel.kind === "checkout" ? properties.viewModel : null,
);
const accepted = ref(false);
const shippingMethod = ref(fashionSourceContract.checkoutPage.shippingMethods[0]);
const paymentMethod = ref(fashionSourceContract.checkoutPage.paymentMethods[0]);
const paypalAssets = fashionSourceContract.productDetail.paymentAssets.slice(0, 4);
</script>

<template>
  <main v-if="checkout" class="fashion-checkout-page">
    <header class="fashion-page-breadcrumb">
      <h1>{{ fashionSourceContract.checkoutPage.heading }}</h1>
      <nav aria-label="Breadcrumb"><NuxtLink to="/">Home</NuxtLink><span>Checkout</span></nav>
    </header>
    <div class="fashion-checkout-prompts">
      <p>
        <span class="fashion-feather-icon fashion-feather-user" aria-hidden="true" />
        <span>Returning customer? <NuxtLink to="/account">Click here to login</NuxtLink></span>
      </p>
      <p>
        <span class="fashion-feather-icon fashion-feather-scissors" aria-hidden="true" />
        <span>Have a coupon? <NuxtLink to="/cart">Click here to enter your code</NuxtLink></span>
      </p>
    </div>
    <form
      class="fashion-checkout-layout"
      @submit.prevent="recordPreviewIntent(checkout.action, 'fashion.checkout')"
    >
      <div class="fashion-checkout-fields">
        <section>
          <h2>Billing details</h2>
          <div class="fashion-form-grid">
            <label
              ><span>First name <b>*</b></span
              ><input required autocomplete="given-name"
            /></label>
            <label
              ><span>Last name <b>*</b></span
              ><input required autocomplete="family-name"
            /></label>
            <label class="fashion-form-wide"
              ><span>Company name (optional)</span><input autocomplete="organization"
            /></label>
            <label class="fashion-form-wide"
              ><span>Country / Region <b>*</b></span
              ><select required autocomplete="country-name">
                <option>United States</option>
                <option>United Kingdom</option>
                <option>China</option>
              </select></label
            >
            <label class="fashion-form-wide"
              ><span>Street address <b>*</b></span
              ><input
                required
                autocomplete="address-line1"
                placeholder="House number and street name"
            /></label>
            <label class="fashion-form-wide"
              ><span class="sr-only">Apartment</span
              ><input
                autocomplete="address-line2"
                placeholder="Apartment, suite, unit etc. (optional)"
            /></label>
            <label class="fashion-form-wide"
              ><span>Town / City <b>*</b></span
              ><input required autocomplete="address-level2"
            /></label>
            <label class="fashion-form-wide"
              ><span>State <b>*</b></span
              ><select required autocomplete="address-level1">
                <option value="">Select a state</option>
                <option>California</option>
                <option>New York</option>
              </select></label
            >
            <label class="fashion-form-wide"
              ><span>Postcode / ZIP <b>*</b></span
              ><input required autocomplete="postal-code"
            /></label>
            <label class="fashion-form-wide"
              ><span>Phone <b>*</b></span
              ><input required type="tel" autocomplete="tel"
            /></label>
            <label class="fashion-form-wide"
              ><span>Email address <b>*</b></span
              ><input required type="email" autocomplete="email"
            /></label>
          </div>
          <label class="fashion-checkout-toggle"><input type="checkbox" />Create an account?</label>
        </section>

        <details class="fashion-checkout-shipping-address">
          <summary>Ship to a different address?</summary>
          <div class="fashion-form-grid">
            <label><span>First name</span><input autocomplete="shipping given-name" /></label>
            <label><span>Last name</span><input autocomplete="shipping family-name" /></label>
            <label class="fashion-form-wide"
              ><span>Country / Region</span
              ><select>
                <option>United States</option>
                <option>China</option>
              </select></label
            >
            <label class="fashion-form-wide"
              ><span>Street address</span><input placeholder="House number and street name"
            /></label>
            <label><span>Town / City</span><input /></label>
            <label><span>Postcode / ZIP</span><input /></label>
          </div>
        </details>

        <section class="fashion-checkout-notes">
          <label
            ><span>Order notes (optional)</span
            ><textarea
              rows="5"
              placeholder="Notes about your order, e.g. special notes for delivery."
            />
          </label>
        </section>
      </div>

      <aside class="fashion-checkout-summary">
        <h2>Your order</h2>
        <dl class="fashion-checkout-order-lines">
          <div class="fashion-checkout-order-heading">
            <dt>Product</dt>
            <dd>Subtotal</dd>
          </div>
          <div v-for="item in fashionSourceContract.cartPage.items" :key="item.name">
            <dt>
              {{ item.name }} × {{ item.quantity }}<small>Color: {{ item.color }}</small>
            </dt>
            <dd>{{ item.total }}</dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd>{{ fashionSourceContract.cartPage.subtotal }}</dd>
          </div>
          <div class="fashion-checkout-shipping-options">
            <dt>Shipping</dt>
            <dd>
              <label
                v-for="method in fashionSourceContract.checkoutPage.shippingMethods"
                :key="method"
              >
                <input
                  v-model="shippingMethod"
                  type="radio"
                  name="checkout-shipping"
                  :value="method"
                />{{ method }}
              </label>
            </dd>
          </div>
          <div class="fashion-checkout-total">
            <dt>Total</dt>
            <dd>
              <strong>{{ fashionSourceContract.cartPage.total }}</strong
              ><small>(Includes $19.29 tax)</small>
            </dd>
          </div>
        </dl>

        <fieldset class="fashion-checkout-payment-methods">
          <legend class="sr-only">Payment method</legend>
          <label v-for="method in fashionSourceContract.checkoutPage.paymentMethods" :key="method">
            <span
              ><input
                v-model="paymentMethod"
                type="radio"
                name="payment-option"
                :value="method" />{{ method }}
              <span v-if="method === 'PayPal'" class="fashion-checkout-payment-logos">
                <img
                  v-for="assetId in paypalAssets"
                  :key="assetId"
                  :src="properties.resolveAsset(assetId)"
                  alt=""
                  width="38"
                  height="24"
                /> </span
            ></span>
            <small v-if="method === paymentMethod">
              Make your payment directly into our bank account. Please use your Order ID as the
              payment reference. Your order will not be shipped until the funds have cleared in our
              account.
            </small>
          </label>
        </fieldset>
        <p class="fashion-checkout-privacy">
          Your personal data will be used to process your order and support your experience
          throughout this website, and for other purposes described in our
          <NuxtLink to="/policies/privacy">privacy policy</NuxtLink>.
        </p>
        <label class="fashion-checkout-consent"
          ><input v-model="accepted" type="checkbox" /><span
            >I have read and agree to the website
            <NuxtLink to="/policies/terms">terms and conditions</NuxtLink>.</span
          ></label
        >
        <button type="submit" :disabled="!accepted">{{ checkout.action.label }}</button>
      </aside>
    </form>
  </main>
</template>
