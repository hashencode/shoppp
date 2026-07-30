import ActionBlock from "../components/blocks/ActionBlock.vue";
import LinkBlock from "../components/blocks/LinkBlock.vue";
import ProductCardBlock from "../components/blocks/ProductCardBlock.vue";
import TextBlock from "../components/blocks/TextBlock.vue";
import AnnouncementSection from "../components/sections/AnnouncementSection.vue";
import CartSummarySection from "../components/sections/CartSummarySection.vue";
import CheckoutShellSection from "../components/sections/CheckoutShellSection.vue";
import CollectionGridSection from "../components/sections/CollectionGridSection.vue";
import EditorialSection from "../components/sections/EditorialSection.vue";
import FooterSection from "../components/sections/FooterSection.vue";
import HeroSection from "../components/sections/HeroSection.vue";
import NavigationSection from "../components/sections/NavigationSection.vue";
import OrderStatusSection from "../components/sections/OrderStatusSection.vue";
import PolicyContentSection from "../components/sections/PolicyContentSection.vue";
import ProductGridSection from "../components/sections/ProductGridSection.vue";
import ProductPresentationSection from "../components/sections/ProductPresentationSection.vue";
import PromotionSection from "../components/sections/PromotionSection.vue";
import StateSection from "../components/sections/StateSection.vue";
import TrustStripSection from "../components/sections/TrustStripSection.vue";
import type { ThemeRegistry } from "./registry";

export const coreThemeRegistry = {
  blocks: {
    "core.action": ActionBlock,
    "core.link": LinkBlock,
    "core.product-card": ProductCardBlock,
    "core.text": TextBlock,
  },
  sections: {
    "core.announcement": AnnouncementSection,
    "core.cart": CartSummarySection,
    "core.checkout": CheckoutShellSection,
    "core.collection-grid": CollectionGridSection,
    "core.editorial": EditorialSection,
    "core.footer": FooterSection,
    "core.hero": HeroSection,
    "core.navigation": NavigationSection,
    "core.order": OrderStatusSection,
    "core.policy": PolicyContentSection,
    "core.product": ProductPresentationSection,
    "core.product-grid": ProductGridSection,
    "core.promotion": PromotionSection,
    "core.state": StateSection,
    "core.trust-strip": TrustStripSection,
  },
} as const satisfies ThemeRegistry;
