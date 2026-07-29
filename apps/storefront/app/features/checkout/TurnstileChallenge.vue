<script setup lang="ts">
interface TurnstileApi {
  remove(widgetId: string): void;
  render(
    container: HTMLElement,
    options: {
      action: string;
      callback(token: string): void;
      "error-callback"(): void;
      "expired-callback"(): void;
      sitekey: string;
      theme: "auto";
    },
  ): string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const props = defineProps<{ sitekey: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const container = ref<HTMLElement>();
const unavailable = ref(false);
let widgetId: string | undefined;
let pollTimer: number | undefined;

useHead({
  script: [
    {
      async: true,
      defer: true,
      src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    },
  ],
});

onMounted(() => {
  let attempts = 0;
  pollTimer = window.setInterval(() => {
    attempts += 1;
    if (window.turnstile && container.value) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
      widgetId = window.turnstile.render(container.value, {
        action: "checkout",
        callback: (token) => emit("update:modelValue", token),
        "error-callback": () => {
          unavailable.value = true;
          emit("update:modelValue", "");
        },
        "expired-callback": () => emit("update:modelValue", ""),
        sitekey: props.sitekey,
        theme: "auto",
      });
    } else if (attempts >= 50) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
      unavailable.value = true;
    }
  }, 100);
});

onBeforeUnmount(() => {
  if (pollTimer) window.clearInterval(pollTimer);
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
});
</script>

<template>
  <div>
    <div ref="container" aria-label="Checkout security check" />
    <p v-if="unavailable" class="form-error" role="alert">
      The security check could not load. Refresh the page before continuing.
    </p>
  </div>
</template>
