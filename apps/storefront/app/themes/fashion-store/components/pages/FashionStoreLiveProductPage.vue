<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import {
  formatCommerceMoney,
  isRuntimeOptionValueAvailable,
  resolveRuntimeProductSelection,
  runtimeCommercePortKey,
  selectRuntimeProductOption,
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
const hydrated = ref(false);
const quantity = ref(1);
const initiallySelectedVariant = properties.viewModel.variants.find(({ selected }) => selected);
const selectedOptions = ref<Record<string, string>>({
  ...(initiallySelectedVariant?.optionValues ?? {}),
});
const optionError = ref("");
const optionErrorElement = ref<HTMLElement | null>(null);
const addCount = ref(0);

const displayedOptionGroups = computed(
  () => runtimeProduct.value?.optionGroups ?? properties.viewModel.optionGroups,
);
const runtimeSelection = computed(() =>
  runtimeProduct.value
    ? resolveRuntimeProductSelection(runtimeProduct.value, selectedOptions.value)
    : null,
);
const selectedRuntimeVariant = computed(() =>
  runtimeSelection.value?.status === "selected" ? runtimeSelection.value.variant : undefined,
);
const displayedPrice = computed(() => {
  const money = selectedRuntimeVariant.value?.money;
  return money
    ? formatCommerceMoney(money.amount, money.currency)
    : properties.viewModel.priceLabel;
});
const displayedMedia = computed(
  () => runtimeProduct.value?.media[0] ?? properties.viewModel.media[0],
);
const canAttemptAdd = computed(
  () =>
    Boolean(runtimeCommerce && properties.viewModel.resource && actionAdapter) &&
    (runtimeStatus.value === "error" ||
      (runtimeStatus.value === "ready" && runtimeProduct.value?.availability === "in-stock")),
);

function syncSelection(product: RuntimeProductState): void {
  if (product.variants.length === 1) {
    selectedOptions.value = { ...product.variants[0]!.options };
    return;
  }
  const optionGroups = new Map(product.optionGroups.map((group) => [group.name, group.values]));
  selectedOptions.value = Object.fromEntries(
    Object.entries(selectedOptions.value).filter(([name, value]) =>
      optionGroups.get(name)?.includes(value),
    ),
  );
}

function selectOption(groupName: string, value: string): void {
  if (!runtimeProduct.value) return;
  selectedOptions.value = selectRuntimeProductOption(
    runtimeProduct.value,
    selectedOptions.value,
    groupName,
    value,
  );
  optionError.value = "";
}

function optionValueAvailable(groupName: string, value: string): boolean {
  if (!runtimeProduct.value) return false;
  return isRuntimeOptionValueAvailable(
    runtimeProduct.value,
    selectedOptions.value,
    groupName,
    value,
  );
}

async function showOptionError(message: string): Promise<void> {
  optionError.value = message;
  await nextTick();
  optionErrorElement.value?.focus();
}

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
    syncSelection(product);
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
  try {
    const currentProduct = runtimeProduct.value ?? (await revalidate());
    if (!currentProduct) return;
    const selection = resolveRuntimeProductSelection(currentProduct, selectedOptions.value);
    if (selection.status === "incomplete") {
      await showOptionError(
        `Choose ${selection.missingGroups.join(" and ")} before adding this item.`,
      );
      return;
    }
    if (selection.status === "unavailable") {
      await showOptionError("That option combination is unavailable. Choose another combination.");
      return;
    }
    optionError.value = "";
    runtimeState.value = {
      kind: "checking",
      message: "Checking current price and availability…",
    };
    const verified = await verifyProductCartAdd(
      runtimeCommerce,
      {
        currency: properties.viewModel.resource.money.currency,
        productId: properties.viewModel.resource.id,
        slug: properties.viewModel.resource.slug,
      },
      selection.variant.id,
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
    const verifiedVariant = verified.product.variants.find(({ id }) => id === verified.variantId);
    if (verifiedVariant) selectedOptions.value = { ...verifiedVariant.options };
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

onMounted(() => {
  hydrated.value = true;
  void revalidate();
});
</script>

<template>
  <FashionStoreShell :resolve-asset="resolveAsset" :show-sticky-socials="false">
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
                v-if="displayedMedia"
                :src="displayedMedia.src"
                :alt="displayedMedia.alt"
                :width="displayedMedia.width"
                :height="displayedMedia.height"
                class="w-100"
              />
              <div
                v-else
                class="fashion-store-product-placeholder"
                role="img"
                :aria-label="viewModel.heading"
              />
            </div>
            <div class="fashion-store-live-product-controls col-lg-5 ps-50px md-ps-15px">
              <div
                v-if="!hydrated"
                class="mb-25px"
                role="region"
                aria-label="JavaScript limitations"
              >
                <p>Shopping actions require JavaScript.</p>
                <a href="/shop">Browse the published catalog</a>
              </div>
              <p class="alt-font text-uppercase fs-12 fw-600 mb-10px">Selected catalog release</p>
              <h1 class="alt-font text-dark-gray fw-600">{{ viewModel.heading }}</h1>
              <p class="fs-22 fw-600 text-dark-gray" data-live-product-price>
                {{ displayedPrice }}
              </p>
              <p>{{ viewModel.description }}</p>
              <a
                v-if="viewModel.relatedCollection"
                :href="viewModel.relatedCollection.href"
                data-fashion-store-route
                class="d-inline-block text-decoration-line-bottom mt-10px"
                >Explore {{ viewModel.relatedCollection.name }}</a
              >

              <fieldset
                v-for="group in displayedOptionGroups"
                :key="group.name"
                class="border-0 p-0 mt-25px"
              >
                <legend class="alt-font fw-600 text-dark-gray fs-16">{{ group.name }}</legend>
                <label v-for="value in group.values" :key="value" class="d-block mb-10px">
                  <input
                    type="radio"
                    :name="`live-product-${group.name}`"
                    :value="value"
                    :checked="selectedOptions[group.name] === value"
                    :disabled="
                      !hydrated ||
                      runtimeStatus !== 'ready' ||
                      !optionValueAvailable(group.name, value)
                    "
                    aria-describedby="live-product-option-error"
                    @change="selectOption(group.name, value)"
                  />
                  {{ value }}
                </label>
              </fieldset>

              <p
                v-if="optionError"
                id="live-product-option-error"
                ref="optionErrorElement"
                class="mt-15px"
                data-product-option-error
                role="alert"
                tabindex="-1"
              >
                {{ optionError }}
              </p>

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
                class="fashion-store-live-product-add btn btn-dark-gray btn-large mt-20px d-block"
                :disabled="!hydrated || runtimeStatus === 'checking' || !canAttemptAdd"
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

<style scoped>
.fashion-store-live-product-controls,
.fashion-store-live-product-controls label,
.fashion-store-live-product-controls input,
.fashion-store-live-product-controls [role="status"] {
  color: #595959;
}

.fashion-store-live-product-add,
.fashion-store-live-product-add:hover,
.fashion-store-live-product-add:active,
.fashion-store-live-product-add:focus-visible {
  color: #fff;
  background-color: #232323;
  border-color: #232323;
}
</style>
