export interface Money {
  readonly amount: number;
  readonly currency: string;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new TypeError("Currency must be a three-letter ISO 4217 code.");
  }
  return normalized;
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new TypeError(`Money currency mismatch: ${left.currency} and ${right.currency}.`);
  }
}

export function createMoney(amount: number, currency: string): Money {
  assertSafeInteger(amount, "Money amount");
  return Object.freeze({ amount, currency: normalizeCurrency(currency) });
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return createMoney(left.amount + right.amount, left.currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return createMoney(left.amount - right.amount, left.currency);
}

export function multiplyMoney(money: Money, quantity: number): Money {
  assertSafeInteger(quantity, "Money multiplier");
  return createMoney(money.amount * quantity, money.currency);
}

export function assertMoneyCurrency(money: Money, currency: string): void {
  const normalizedCurrency = normalizeCurrency(currency);
  if (money.currency !== normalizedCurrency) {
    throw new TypeError(`Money currency mismatch: ${money.currency} and ${normalizedCurrency}.`);
  }
}
