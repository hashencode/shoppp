<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import {
  formatCommerceMoney,
  runtimeCommercePortKey,
  verifyProductCartAdd,
  type RuntimeProductState,
} from "../../../../theme-engine/runtime-commerce";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

type ProductViewModel = Extract<PresentationViewModel, { kind: "product" }>;

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: ProductViewModel;
}>();

const actionAdapter = inject(storefrontActionAdapterKey);
const runtimeCommerce = inject(runtimeCommercePortKey);
const runtimeProduct = ref<RuntimeProductState | null>(null);
const runtimeState = ref<{
  kind: "checking" | "error" | "ready" | "static";
  message: string;
}>({ kind: "static", message: "Published product details are available." });
const runtimeStatus = computed(() => runtimeState.value.kind);
const statusMessage = computed(() => runtimeState.value.message);
const quantity = ref(1);
const selectedVariantId = ref(
  properties.viewModel.variants.find(({ selected }) => selected)?.id ??
    properties.viewModel.variants[0]?.id ??
    "",
);
const addCount = ref(0);

const runtimeVariants = computed(() => runtimeProduct.value?.variants ?? []);
const selectedRuntimeVariant = computed(() =>
  runtimeVariants.value.find(({ id }) => id === selectedVariantId.value),
);
const displayedPrice = computed(() => {
  const money = selectedRuntimeVariant.value?.money;
  return money
    ? formatCommerceMoney(money.amount, money.currency)
    : properties.viewModel.priceLabel;
});
const canAdd = computed(
  () =>
    runtimeStatus.value === "ready" &&
    runtimeProduct.value?.availability === "in-stock" &&
    selectedRuntimeVariant.value?.availability === "in-stock" &&
    Boolean(actionAdapter),
);

async function revalidate(): Promise<RuntimeProductState | null> {
  if (!runtimeCommerce || !properties.viewModel.resource) {
    runtimeState.value = {
      kind: "error",
      message: "Current price and availability cannot be verified. Try again later.",
    };
    return null;
  }
  runtimeState.value = {
    kind: "checking",
    message: "Checking current price and availability…",
  };
  try {
    const product = await runtimeCommerce.revalidateProduct({
      currency: properties.viewModel.resource.money.currency,
      productId: properties.viewModel.resource.id,
      slug: properties.viewModel.resource.slug,
    });
    runtimeProduct.value = product;
    if (!product.variants.some(({ id }) => id === selectedVariantId.value)) {
      selectedVariantId.value = product.variants[0]?.id ?? "";
    }
    runtimeState.value = {
      kind: "ready",
      message:
        product.availability === "in-stock"
          ? "Current price and availability verified."
          : "This product is currently unavailable.",
    };
    return product;
  } catch {
    runtimeState.value = {
      kind: "error",
      message:
        "Current price and availability could not be verified. Static product details remain available; try again.",
    };
    return null;
  }
}

async function addToCart(): Promise<void> {
  if (!runtimeCommerce || !properties.viewModel.resource || !actionAdapter) return;
  runtimeState.value = {
    kind: "checking",
    message: "Checking current price and availability…",
  };
  try {
    const verified = await verifyProductCartAdd(
      runtimeCommerce,
      {
        currency: properties.viewModel.resource.money.currency,
        productId: properties.viewModel.resource.id,
        slug: properties.viewModel.resource.slug,
      },
      selectedVariantId.value,
      quantity.value,
    );
    if (!verified) {
      runtimeState.value = {
        kind: "ready",
        message: "This product or variant is currently unavailable.",
      };
      return;
    }
    runtimeProduct.value = verified.product;
    selectedVariantId.value = verified.variantId;
    runtimeState.value = {
      kind: "checking",
      message: "Adding the verified item to your cart…",
    };
    await actionAdapter({
      context: "fashion-store.live-product.cart",
      currency: verified.input.expectedUnitPrice.currency,
      input: verified.input,
      kind: "cart.add",
    });
    addCount.value += 1;
    runtimeState.value = {
      kind: "ready",
      message: `${properties.viewModel.heading} was added to your cart.`,
    };
  } catch {
    runtimeState.value = {
      kind: "error",
      message: "The item was not added. Review any changes and try again.",
    };
  }
}

onMounted(() => void revalidate());
</script>

<template>
  <FashionStoreShell
    announcement="Price and availability are verified by Commerce before purchase."
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-live-product
      :data-cart-add-count="addCount"
      :data-runtime-status="runtimeStatus"
    >
      <section class="top-space-margin pt-70px pb-70px">
        <div class="container">
          <div class="row align-items-start">
            <div class="col-lg-7 md-mb-40px">
              <img
                v-if="viewModel.media[0]"
                :src="viewModel.media[0].src"
                :alt="viewModel.media[0].alt"
                :width="viewModel.media[0].width"
                :height="viewModel.media[0].height"
                class="w-100"
              />
              <div
                v-else
                class="fashion-store-product-placeholder"
                role="img"
                :aria-label="viewModel.heading"
              />
            </div>
            <div class="col-lg-5 ps-50px md-ps-15px">
              <p class="alt-font text-uppercase fs-12 fw-600 mb-10px">Selected catalog release</p>
              <h1 class="alt-font text-dark-gray fw-600">{{ viewModel.heading }}</h1>
              <p class="fs-22 fw-600 text-dark-gray" data-live-product-price>
                {{ displayedPrice }}
              </p>
              <p>{{ viewModel.description }}</p>

              <fieldset v-if="runtimeVariants.length" class="border-0 p-0 mt-25px">
                <legend class="alt-font fw-600 text-dark-gray fs-16">Variant</legend>
                <label v-for="variant in runtimeVariants" :key="variant.id" class="d-block mb-10px">
                  <input
                    v-model="selectedVariantId"
                    type="radio"
                    name="live-product-variant"
                    :value="variant.id"
                    :disabled="variant.availability !== 'in-stock'"
                  />
                  {{ variant.label }}
                  <span v-if="variant.availability !== 'in-stock'"> — Out of stock</span>
                </label>
              </fieldset>

              <label class="d-block mt-20px" for="live-product-quantity">Quantity</label>
              <input
                id="live-product-quantity"
                v-model.number="quantity"
                type="number"
                min="1"
                max="20"
                class="input-small"
              />
              <button
                type="button"
                class="btn btn-dark-gray btn-large mt-20px d-block"
                :disabled="runtimeStatus === 'checking' || (runtimeStatus === 'ready' && !canAdd)"
                @click="addToCart"
              >
                {{ runtimeStatus === "error" ? "Retry and add to cart" : "Add to cart" }}
              </button>
              <p
                class="mt-15px"
                :role="runtimeStatus === 'error' ? 'alert' : 'status'"
                aria-live="polite"
                data-live-product-status
              >
                {{ statusMessage }}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
