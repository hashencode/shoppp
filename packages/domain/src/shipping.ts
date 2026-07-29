export interface ShippingMethodPolicy {
  readonly calculationType: "flat" | "weight";
  readonly currency: string;
  readonly freeThresholdAmount: number | null;
  readonly id: string;
  readonly maxWeightGrams: number | null;
  readonly minWeightGrams: number | null;
  readonly name: string;
  readonly priceAmount: number;
}

export interface ShippingQuote {
  readonly amount: number;
  readonly currency: string;
  readonly id: string;
  readonly name: string;
}

export interface ShippingQuoteInput {
  readonly currency: string;
  readonly methods: readonly ShippingMethodPolicy[];
  readonly subtotalAmount: number;
  readonly totalWeightGrams: number;
}

function assertMinorUnits(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

export function quoteShippingMethods(input: ShippingQuoteInput): ShippingQuote[] {
  assertMinorUnits(input.subtotalAmount, "Subtotal");
  assertMinorUnits(input.totalWeightGrams, "Total weight");
  return input.methods.flatMap((method) => {
    assertMinorUnits(method.priceAmount, "Shipping price");
    if (method.currency !== input.currency) return [];
    if (method.minWeightGrams !== null && input.totalWeightGrams < method.minWeightGrams) return [];
    if (method.maxWeightGrams !== null && input.totalWeightGrams > method.maxWeightGrams) return [];
    const amount =
      method.freeThresholdAmount !== null && input.subtotalAmount >= method.freeThresholdAmount
        ? 0
        : method.calculationType === "weight"
          ? method.priceAmount * Math.max(1, Math.ceil(input.totalWeightGrams / 1_000))
          : method.priceAmount;
    assertMinorUnits(amount, "Shipping quote");
    return [{ amount, currency: input.currency, id: method.id, name: method.name }];
  });
}
