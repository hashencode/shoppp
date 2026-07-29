import {
  addMoney,
  assertMoneyCurrency,
  createMoney,
  multiplyMoney,
  subtractMoney,
  type Money,
} from "./money";

export interface PricingLine {
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface PricingInput {
  readonly currency: string;
  readonly discount: Money;
  readonly lines: readonly PricingLine[];
  readonly shipping: Money;
  readonly tax: Money;
}

export interface PricingTotals {
  readonly currency: string;
  readonly discountTotal: number;
  readonly grandTotal: number;
  readonly shippingTotal: number;
  readonly subtotal: number;
  readonly taxTotal: number;
}

export function calculatePricing(input: PricingInput): PricingTotals {
  const zero = createMoney(0, input.currency);
  for (const amount of [input.discount, input.shipping, input.tax]) {
    assertMoneyCurrency(amount, zero.currency);
  }
  const subtotal = input.lines.reduce((total, line) => {
    assertMoneyCurrency(line.unitPrice, zero.currency);
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError("Line quantity must be a positive safe integer.");
    }
    return addMoney(total, multiplyMoney(line.unitPrice, line.quantity));
  }, zero);
  const discounted = subtractMoney(subtotal, input.discount);
  if (discounted.amount < 0) {
    throw new RangeError("Discount cannot produce a negative subtotal.");
  }
  const grandTotal = addMoney(addMoney(discounted, input.shipping), input.tax);

  return {
    currency: zero.currency,
    discountTotal: input.discount.amount,
    grandTotal: grandTotal.amount,
    shippingTotal: input.shipping.amount,
    subtotal: subtotal.amount,
    taxTotal: input.tax.amount,
  };
}
