import type { ComputedRef, InjectionKey } from "vue";

import type { PlatformRoutePresentationViewModel, PresentationShellViewModel } from "./view-models";

export const storefrontPresentationShellKey: InjectionKey<
  ComputedRef<PresentationShellViewModel | undefined>
> = Symbol("storefront-presentation-shell");

export const storefrontPlatformPresentationKey: InjectionKey<
  ComputedRef<PlatformRoutePresentationViewModel | undefined>
> = Symbol("storefront-platform-presentation");
