import type { ComputedRef, InjectionKey, Ref } from "vue";

import type {
  PlatformRoutePresentationViewModel,
  PresentationShellRenderViewModel,
} from "./view-models";

export const storefrontPresentationShellKey: InjectionKey<
  ComputedRef<PresentationShellRenderViewModel | undefined>
> = Symbol("storefront-presentation-shell");

export const storefrontPreviewIntentCountKey: InjectionKey<Ref<number>> = Symbol(
  "storefront-preview-intent-count",
);

export const storefrontPlatformPresentationKey: InjectionKey<
  ComputedRef<PlatformRoutePresentationViewModel | undefined>
> = Symbol("storefront-platform-presentation");
