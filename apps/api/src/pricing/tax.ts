export interface TaxQuoteInput {
  currency: string;
  destinationCountry: string | null;
  taxableAmount: number;
}

export interface TaxPort {
  quote(input: TaxQuoteInput): Promise<{ amount: number; currency: string }>;
}

const zeroTaxPort: TaxPort = {
  async quote(input) {
    return { amount: 0, currency: input.currency };
  },
};

export function configuredTaxPort(mode: "zero"): TaxPort {
  if (mode === "zero") return zeroTaxPort;
  throw new Error("Unsupported tax mode.");
}
