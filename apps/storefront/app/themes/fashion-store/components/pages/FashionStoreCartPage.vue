<script setup lang="ts">
import type { Cart } from "@shoppp/contracts";

import { recordPreviewIntent, storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { storefrontCheckoutAdapterKey } from "../../../../theme-engine/checkout";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { formatCommerceMoney } from "../../../../theme-engine/runtime-commerce";
import type { FashionStoreCartData, FashionStoreCartLine } from "../../fixtures/pages/cart";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const isLive = computed(() => properties.viewModel.kind === "cart");
const initialFixtureData =
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as FashionStoreCartData)
    : undefined;
const data = computed<FashionStoreCartData>(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Cart requires a theme-section fixture.");
  }
  return properties.viewModel.data as unknown as FashionStoreCartData;
});
const actionAdapter = inject(storefrontActionAdapterKey);
const checkoutAdapter = inject(storefrontCheckoutAdapterKey);
const lines = ref<FashionStoreCartLine[]>([]);
const totals = reactive({ subtotal: "$0.00", tax: "(Includes $0.00 tax)", total: "$0.00" });
const cartStatus = ref<"error" | "loading" | "ready">("loading");
const cartLoadError = ref("");
const displayedLines = computed(() =>
  cartStatus.value === "loading" && initialFixtureData ? initialFixtureData.lines : lines.value,
);
const selectedShipping = ref(initialFixtureData?.shipping[0]?.id ?? "");
const shippingOptions = ref<{ id: string; label: string }[]>(
  initialFixtureData?.shipping.map(({ id, label }) => ({ id, label })) ?? [],
);
const countryOptions = initialFixtureData?.countries ?? [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
];
const canCheckout = ref(false);
const cartAnnouncements = ref<string[]>([]);
const shippingOpen = ref(false);
const countryCode = ref("");
const region = ref("");
const city = ref("");
const postalCode = ref("");
const coupon = ref("");
const couponInvalid = ref(false);
const shippingInvalid = ref(false);
const busy = ref(false);
const mutationCount = ref(0);
const localActionCount = ref(0);

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function money(amount: number, currency: string): string {
  return formatCommerceMoney(amount, currency);
}

function applyOwnerCart(cart: Cart): void {
  const sourceByVariant = new Map(
    (initialFixtureData?.lines ?? []).map((line) => [line.variantId, line]),
  );
  lines.value = cart.lines.map((line) => {
    const source = sourceByVariant.get(line.variantId);
    return {
      color: source?.color ?? line.variantName,
      name: line.productName,
      price: money(line.unitPrice.amount, line.unitPrice.currency),
      quantity: line.quantity,
      sourceImage: source?.sourceImage ?? "",
      total: money(line.lineTotal.amount, line.lineTotal.currency),
      variantId: line.variantId,
    };
  });
  totals.subtotal = money(cart.totals.subtotal, cart.currency);
  totals.total = money(cart.totals.grandTotal, cart.currency);
  totals.tax = `(Includes ${money(cart.totals.taxTotal, cart.currency)} tax)`;
  shippingOptions.value = cart.shippingMethods.map((method) => ({
    id: method.id,
    label: `${method.name} — ${money(method.amount, method.currency)}`,
  }));
  canCheckout.value = cart.canCheckout;
  cartAnnouncements.value = cart.adjustments.map(({ message }) => message);
  if (cart.selectedShippingMethodId) selectedShipping.value = cart.selectedShippingMethodId;
}

function applyFixtureCart(): void {
  if (!initialFixtureData) return;
  lines.value = data.value.lines.map((line) => ({ ...line }));
  Object.assign(totals, data.value.totals);
  cartStatus.value = "ready";
}

async function updateQuantity(line: FashionStoreCartLine, nextQuantity: number): Promise<void> {
  if (busy.value || !actionAdapter) return;
  const quantity = Math.min(20, Math.max(1, Math.floor(nextQuantity || 1)));
  if (quantity === line.quantity) return;
  if (initialFixtureData) {
    recordPreviewIntent(initialFixtureData.actions.update, "fashion-store.cart.quantity");
  }
  busy.value = true;
  cartLoadError.value = "";
  try {
    applyOwnerCart(
      await actionAdapter({
        context: "fashion-store.cart.quantity",
        input: { quantity },
        kind: "cart.update",
        variantId: line.variantId,
      }),
    );
    mutationCount.value += 1;
  } catch {
    cartLoadError.value =
      checkoutAdapter?.status().error ?? "The cart quantity could not be updated. Try again.";
  } finally {
    busy.value = false;
  }
}

async function removeLine(line: FashionStoreCartLine): Promise<void> {
  if (busy.value || !actionAdapter) return;
  const removedIndex = lines.value.findIndex(({ variantId }) => variantId === line.variantId);
  if (initialFixtureData) {
    recordPreviewIntent(initialFixtureData.actions.remove, "fashion-store.cart.remove");
  }
  busy.value = true;
  cartLoadError.value = "";
  let restoreFocus = false;
  try {
    applyOwnerCart(
      await actionAdapter({
        context: "fashion-store.cart.remove",
        kind: "cart.remove",
        variantId: line.variantId,
      }),
    );
    mutationCount.value += 1;
    restoreFocus = true;
  } catch {
    cartLoadError.value =
      checkoutAdapter?.status().error ?? "The cart item could not be removed. Try again.";
  } finally {
    busy.value = false;
  }
  if (restoreFocus) {
    await nextTick();
    const nextRemove = document.querySelectorAll<HTMLButtonElement>(
      ".cart-products .product-remove button",
    )[Math.min(removedIndex, lines.value.length - 1)];
    (nextRemove ?? document.querySelector<HTMLButtonElement>("[data-empty-cart]"))?.focus();
  }
}

async function emptyCart(): Promise<void> {
  for (const line of [...lines.value]) {
    await removeLine(line);
  }
}

function updateCartPresentation(): void {
  if (initialFixtureData) {
    recordPreviewIntent(initialFixtureData.actions.update, "fashion-store.cart.update");
  }
  localActionCount.value += 1;
}

function validateCoupon(): void {
  couponInvalid.value = coupon.value.trim().length === 0;
  if (initialFixtureData) {
    recordPreviewIntent(initialFixtureData.actions.coupon, "fashion-store.cart.coupon");
  }
  localActionCount.value += 1;
  if (couponInvalid.value) {
    void nextTick(() => document.querySelector<HTMLInputElement>("#fashion-cart-coupon")?.focus());
  }
}

async function updateShipping(): Promise<void> {
  shippingInvalid.value = !countryCode.value || !city.value.trim() || !postalCode.value.trim();
  if (shippingInvalid.value || busy.value || !actionAdapter) return;
  if (initialFixtureData) {
    recordPreviewIntent(initialFixtureData.actions.shipping, "fashion-store.cart.shipping");
  }
  busy.value = true;
  cartLoadError.value = "";
  try {
    applyOwnerCart(
      await actionAdapter({
        context: "fashion-store.cart.shipping",
        input: {
          shippingAddress: {
            city: city.value.trim(),
            countryCode: countryCode.value,
            line1: city.value.trim(),
            name: "Guest",
            postalCode: postalCode.value.trim(),
            ...(region.value.trim() ? { region: region.value.trim() } : {}),
          },
          ...(selectedShipping.value ? { shippingMethodId: selectedShipping.value } : {}),
        },
        kind: "cart.shipping",
      }),
    );
    mutationCount.value += 1;
  } catch {
    cartLoadError.value =
      checkoutAdapter?.status().error ?? "Delivery options are unavailable. Try again.";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  if (!checkoutAdapter) {
    cartLoadError.value = "Cart is unavailable.";
    if (isLive.value) cartStatus.value = "error";
    else applyFixtureCart();
    return;
  }
  try {
    applyOwnerCart(await checkoutAdapter.ensure());
    const { notice } = checkoutAdapter.status();
    if (notice) cartAnnouncements.value.unshift(notice);
    cartStatus.value = "ready";
  } catch {
    cartLoadError.value =
      checkoutAdapter.status().error ?? "Cart is unavailable. Please try again.";
    if (isLive.value) cartStatus.value = "error";
    else applyFixtureCart();
  }
});
</script>

<template>
  <FashionStoreShell
    :announcement="initialFixtureData?.announcement ?? 'Cart totals are verified by Commerce.'"
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-cart
      :data-runtime-status="cartStatus"
      :data-local-action-count="localActionCount"
      :data-mutation-count="mutationCount"
    >
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container">
          <div class="row align-items-center justify-content-center">
            <div
              class="col-12 col-xl-8 col-lg-10 text-center position-relative page-title-extra-large"
            >
              <h1 class="alt-font fw-600 text-dark-gray mb-10px">Shopping cart</h1>
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
                <li>Shopping cart</li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <section class="pt-0 fashion-cart-body">
        <div class="container">
          <div class="row align-items-start">
            <div class="col-lg-8 pe-50px md-pe-15px md-mb-50px xs-mb-35px">
              <div class="row align-items-center">
                <div class="col-12">
                  <p v-if="cartLoadError" class="form-error" role="alert">{{ cartLoadError }}</p>
                  <ul
                    v-if="cartAnnouncements.length"
                    class="form-error"
                    role="status"
                    aria-live="polite"
                  >
                    <li v-for="message in cartAnnouncements" :key="message">{{ message }}</li>
                  </ul>
                  <table class="table cart-products">
                    <thead>
                      <tr>
                        <th scope="col"></th>
                        <th scope="col" class="alt-font fw-600">Product</th>
                        <th scope="col"></th>
                        <th scope="col" class="alt-font fw-600">Price</th>
                        <th scope="col" class="alt-font fw-600">Quantity</th>
                        <th scope="col" class="alt-font fw-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="line in displayedLines"
                        :key="line.variantId"
                        :aria-hidden="cartStatus === 'loading'"
                        :class="{ 'fashion-cart-loading-row': cartStatus === 'loading' }"
                        :data-variant-id="line.variantId"
                      >
                        <td class="product-remove">
                          <button
                            type="button"
                            class="fs-20 fw-500"
                            :aria-label="`Remove ${line.name}`"
                            :disabled="busy"
                            @click="removeLine(line)"
                          >
                            ×
                          </button>
                        </td>
                        <td class="product-thumbnail">
                          <a
                            v-if="line.sourceImage"
                            :href="fashionStoreRoutePaths.product"
                            data-fashion-store-route
                          >
                            <img
                              class="cart-product-image"
                              :src="sourceAsset(line.sourceImage)"
                              alt=""
                            />
                          </a>
                          <span
                            v-else
                            class="fashion-store-product-placeholder"
                            aria-hidden="true"
                          ></span>
                        </td>
                        <td class="product-name">
                          <a
                            v-if="line.sourceImage"
                            :href="fashionStoreRoutePaths.product"
                            data-fashion-store-route
                            class="text-dark-gray fw-500 d-block lh-initial"
                            >{{ line.name }}</a
                          >
                          <span v-else class="text-dark-gray fw-500 d-block lh-initial">{{
                            line.name
                          }}</span>
                          <span class="fs-14">Color: {{ line.color }}</span>
                        </td>
                        <td class="product-price" data-title="Price">{{ line.price }}</td>
                        <td class="product-quantity" data-title="Quantity">
                          <div class="quantity">
                            <button
                              type="button"
                              class="qty-minus"
                              :aria-label="`Decrease ${line.name} quantity`"
                              :disabled="busy || line.quantity <= 1"
                              @click="updateQuantity(line, line.quantity - 1)"
                            >
                              -
                            </button>
                            <input
                              class="qty-text"
                              type="number"
                              min="1"
                              max="20"
                              :value="line.quantity"
                              :aria-label="`${line.name} quantity`"
                              :disabled="busy"
                              @change="
                                updateQuantity(
                                  line,
                                  Number(($event.target as HTMLInputElement).value),
                                )
                              "
                            />
                            <button
                              type="button"
                              class="qty-plus"
                              :aria-label="`Increase ${line.name} quantity`"
                              :disabled="busy"
                              @click="updateQuantity(line, line.quantity + 1)"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td class="product-subtotal" data-title="Total">{{ line.total }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="row mt-20px">
                <div class="col-xl-6 col-xxl-7 col-md-6">
                  <div class="coupon-code-panel">
                    <input
                      id="fashion-cart-coupon"
                      v-model="coupon"
                      type="text"
                      class="bg-white border-radius-4px"
                      placeholder="Coupon code"
                      :aria-invalid="couponInvalid"
                      @input="couponInvalid = false"
                    />
                    <button
                      type="button"
                      class="btn apply-coupon-btn fs-13 fw-600 text-uppercase"
                      @click="validateCoupon"
                    >
                      Apply
                    </button>
                  </div>
                </div>
                <div class="col-xl-6 col-xxl-5 col-md-6 text-center text-md-end sm-mt-15px">
                  <button
                    type="button"
                    data-empty-cart
                    class="btn btn-small border-1 btn-round-edge btn-transparent-light-gray text-transform-none me-15px lg-me-5px"
                    :disabled="busy"
                    @click="emptyCart"
                  >
                    Empty cart
                  </button>
                  <button
                    type="button"
                    class="btn btn-small border-1 btn-round-edge btn-transparent-light-gray text-transform-none"
                    @click="updateCartPresentation"
                  >
                    Update cart
                  </button>
                </div>
              </div>
            </div>

            <div class="col-lg-4">
              <div class="bg-very-light-gray border-radius-6px p-50px xl-p-30px lg-p-25px">
                <span class="fs-26 alt-font fw-600 text-dark-gray mb-5px d-block">Cart totals</span>
                <table class="w-100 total-price-table">
                  <tbody>
                    <tr>
                      <th class="w-45 fw-600 text-dark-gray alt-font">Subtotal</th>
                      <td class="text-dark-gray fw-600">{{ totals.subtotal }}</td>
                    </tr>
                    <tr class="shipping">
                      <th class="fw-600 text-dark-gray alt-font">Shipping</th>
                      <td data-title="Shipping">
                        <ul class="p-0 m-0">
                          <li
                            v-for="option in shippingOptions"
                            :key="option.id"
                            class="d-flex align-items-center"
                          >
                            <input
                              :id="option.id"
                              v-model="selectedShipping"
                              type="radio"
                              name="shipping-option"
                              class="d-block w-auto mb-0 me-10px p-0"
                              :value="option.id"
                            />
                            <label class="md-line-height-18px" :for="option.id">{{
                              option.label
                            }}</label>
                          </li>
                        </ul>
                      </td>
                    </tr>
                    <tr class="calculate-shipping">
                      <th colspan="2" class="fw-500">
                        <button
                          type="button"
                          class="d-flex align-items-center calculate-shipping-title accordion-toggle"
                          :aria-expanded="shippingOpen"
                          aria-controls="shipping-accordion"
                          @click="shippingOpen = !shippingOpen"
                        >
                          <span class="fw-600 w-100 mb-0 text-dark-gray">Calculate shipping</span>
                          <i
                            class="feather icon-feather-chevron-down text-dark-gray icon-small align-middle"
                          ></i>
                        </button>
                        <div
                          id="shipping-accordion"
                          class="address-block collapse"
                          :class="{ show: shippingOpen }"
                        >
                          <div class="mt-15px">
                            <select
                              v-model="countryCode"
                              class="form-select select-small mb-15px"
                              :aria-invalid="shippingInvalid && !countryCode"
                            >
                              <option value="">Select a country</option>
                              <option
                                v-for="country in countryOptions"
                                :key="country.code"
                                :value="country.code"
                              >
                                {{ country.label }}
                              </option>
                            </select>
                            <select v-model="region" class="form-select select-small mb-15px">
                              <option value="">Select state</option>
                            </select>
                            <input
                              v-model="city"
                              type="text"
                              name="city"
                              class="input-small border-radius-4px mb-15px"
                              placeholder="Town/City"
                              :aria-invalid="shippingInvalid && !city.trim()"
                            />
                            <input
                              v-model="postalCode"
                              type="text"
                              name="zip"
                              class="input-small border-radius-4px mb-15px"
                              placeholder="ZIP"
                              :aria-invalid="shippingInvalid && !postalCode.trim()"
                            />
                            <button
                              type="button"
                              class="btn btn-small btn-box-shadow btn-round-edge btn-dark-gray w-100"
                              :disabled="busy"
                              @click="updateShipping"
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      </th>
                    </tr>
                    <tr class="total-amount">
                      <th class="fw-600 text-dark-gray alt-font pb-0">Total</th>
                      <td class="pb-0" data-title="Total">
                        <h6 class="d-block fw-700 mb-0 text-dark-gray alt-font">
                          {{ totals.total }}
                        </h6>
                        <span class="fs-14">{{ totals.tax }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <a
                  v-if="canCheckout || !isLive"
                  :href="fashionStoreRoutePaths.checkout"
                  data-fashion-store-route
                  class="btn btn-dark-gray btn-large btn-switch-text btn-round-edge btn-box-shadow w-100 mt-25px"
                >
                  <span
                    ><span class="btn-double-text" data-text="Proceed to checkout"
                      >Proceed to checkout</span
                    ></span
                  >
                </a>
                <span v-else class="d-block mt-20px" role="status">
                  Checkout is unavailable until cart changes are resolved.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
