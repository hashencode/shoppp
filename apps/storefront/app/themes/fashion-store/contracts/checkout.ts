import type { PreviewAction } from "../../../theme-engine/actions";

export interface FashionStoreLegacyCheckoutData {
  action: PreviewAction;
  announcement: string;
  countries: readonly { code: string; label: string }[];
  lines: readonly {
    color: string;
    name: string;
    quantity: number;
    total: string;
    variantId: string;
  }[];
  payment: readonly {
    detail: string;
    id: string;
    label: string;
    sourceImage?: string;
  }[];
  shipping: readonly { amount: string; id: string; label: string }[];
  totals: { subtotal: string; tax: string; total: string };
}
