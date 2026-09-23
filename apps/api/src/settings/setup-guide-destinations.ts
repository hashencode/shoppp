import type {
  AdminPermission,
  SetupGuideDestination,
  SetupGuideDestinations,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { hasPermission } from "../iam/permissions";

const destinations: readonly (SetupGuideDestination & { permission: AdminPermission })[] = [
  { href: "/settings/identity?from=setup-guide", id: "identity", permission: "identity.read" },
  { href: "/settings/contact?from=setup-guide", id: "contact", permission: "settings.read" },
  { href: "/settings/policies?from=setup-guide", id: "policies", permission: "policies.read" },
  { href: "/catalog/products?from=setup-guide", id: "products", permission: "catalog.read" },
  { href: "/catalog/collections?from=setup-guide", id: "collections", permission: "catalog.read" },
  { href: "/content/pages?from=setup-guide", id: "pages", permission: "content.read" },
  { href: "/content/articles?from=setup-guide", id: "articles", permission: "content.read" },
  {
    href: "/storefront/navigation?from=setup-guide",
    id: "navigation",
    permission: "navigation.read",
  },
  { href: "/storefront/themes?from=setup-guide", id: "themes", permission: "themes.read" },
  { href: "/settings/shipping?from=setup-guide", id: "shipping", permission: "settings.read" },
  { href: "/settings/launch?from=setup-guide", id: "commerce", permission: "settings.read" },
  { href: "/inventory?from=setup-guide", id: "inventory", permission: "inventory.read" },
  { href: "/orders?from=setup-guide", id: "orders", permission: "orders.read" },
];

export function getSetupGuideDestinations(
  context: Context<ApiEnvironment>,
): SetupGuideDestinations {
  const permissions = context.get("principal").permissions;
  return {
    destinations: destinations
      .filter(({ permission }) => hasPermission(permissions, permission))
      .map(({ href, id }) => ({ href, id })),
  };
}
