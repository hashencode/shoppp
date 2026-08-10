import type { PageTemplate } from "@shoppp/contracts";

export interface ThemeRouteContract {
  id: string;
  pageType: PageTemplate["pageType"];
  path: string;
  variant: string;
}

export function normalizeThemeRoutePath(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

export function resolveThemeRoute(
  path: string,
  routes: readonly ThemeRouteContract[],
): ThemeRouteContract | undefined {
  const normalized = normalizeThemeRoutePath(path);
  return routes.find((route) => route.path === normalized);
}
