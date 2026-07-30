import type { BlockDefinition, SectionDefinition } from "@shoppp/contracts";

export const coreBlockDefinitions = [
  {
    capabilities: ["product.action"],
    settings: [],
    type: "core.action",
  },
  {
    capabilities: ["legal.links"],
    settings: [],
    type: "core.link",
  },
  {
    capabilities: ["product.details"],
    settings: [],
    type: "core.product-card",
  },
  {
    capabilities: [],
    settings: [],
    type: "core.text",
  },
] satisfies BlockDefinition[];

export const coreSectionDefinitions = [
  {
    allowedBlockTypes: ["core.action", "core.link"],
    capabilities: ["navigation.primary", "focus.skip-link"],
    settings: [],
    type: "core.navigation",
  },
  {
    allowedBlockTypes: [],
    capabilities: [],
    settings: [],
    type: "core.announcement",
  },
  {
    allowedBlockTypes: ["core.action", "core.text"],
    capabilities: [],
    settings: [],
    type: "core.hero",
  },
  {
    allowedBlockTypes: ["core.link"],
    capabilities: [],
    settings: [],
    type: "core.collection-grid",
  },
  {
    allowedBlockTypes: ["core.product-card"],
    capabilities: [],
    settings: [],
    type: "core.product-grid",
  },
  {
    allowedBlockTypes: ["core.action"],
    capabilities: [],
    settings: [],
    type: "core.promotion",
  },
  {
    allowedBlockTypes: ["core.text"],
    capabilities: [],
    settings: [],
    type: "core.editorial",
  },
  {
    allowedBlockTypes: [],
    capabilities: [],
    settings: [],
    type: "core.trust-strip",
  },
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["legal.links"],
    settings: [],
    type: "core.footer",
  },
  {
    allowedBlockTypes: ["core.action"],
    capabilities: ["product.details", "product.action"],
    settings: [],
    type: "core.product",
  },
  {
    allowedBlockTypes: ["core.action"],
    capabilities: ["cart.summary", "cart.error"],
    settings: [],
    type: "core.cart",
  },
  {
    allowedBlockTypes: ["core.action"],
    capabilities: ["checkout.summary", "checkout.error"],
    settings: [],
    type: "core.checkout",
  },
  {
    allowedBlockTypes: [],
    capabilities: ["order.status", "order.error"],
    settings: [],
    type: "core.order",
  },
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["policy.content"],
    settings: [],
    type: "core.policy",
  },
  {
    allowedBlockTypes: ["core.action"],
    capabilities: ["status.feedback", "error.summary"],
    settings: [],
    type: "core.state",
  },
] satisfies SectionDefinition[];
