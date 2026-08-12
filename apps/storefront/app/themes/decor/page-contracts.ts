import type { PageTemplate } from "@shoppp/contracts";

import type { ThemeRouteContract } from "../../theme-engine/routes";

export interface DecorPageContract extends ThemeRouteContract {
  id: "home";
  pageType: PageTemplate["pageType"];
  sourceEntry: string;
  variant: "home";
}

export const decorThemeRoutes = [
  {
    canonicalPath: "/",
    id: "home",
    indexing: "index",
    modes: ["fixture-preview", "live"],
    path: "/",
    pageType: "home",
    sourceEntry: "demo-decor-store.html",
    variant: "home",
  },
] as const satisfies readonly DecorPageContract[];
