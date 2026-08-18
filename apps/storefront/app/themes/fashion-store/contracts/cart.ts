import type { PreviewAction } from "../../../theme-engine/actions";

export interface FashionStoreLegacyCartLine {
  color: string;
  name: string;
  price: string;
  quantity: number;
  sourceImage: string;
  total: string;
  variantId: string;
}

export interface FashionStoreLegacyCartData {
  actions: {
    coupon: PreviewAction;
    remove: PreviewAction;
    shipping: PreviewAction;
    update: PreviewAction;
  };
  announcement: string;
  countries: readonly { code: string; label: string }[];
  lines: readonly FashionStoreLegacyCartLine[];
  shipping: readonly { id: string; label: string }[];
  totals: {
    subtotal: string;
    tax: string;
    total: string;
  };
}
