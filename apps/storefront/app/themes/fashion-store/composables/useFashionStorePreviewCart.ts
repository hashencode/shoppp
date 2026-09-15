import type { FashionStoreLegacyCartLine } from "../contracts/cart";

const previewCartStateKey = "fashion-store-preview-cart-lines";

function priceAmount(price: string): number {
  const amount = Number(price.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function lineWithQuantity(
  line: FashionStoreLegacyCartLine,
  quantity: number,
): FashionStoreLegacyCartLine {
  return {
    ...line,
    quantity,
    total: new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(
      priceAmount(line.price) * quantity,
    ),
  };
}

export function useFashionStorePreviewCart(
  initialLines: readonly FashionStoreLegacyCartLine[] = [],
) {
  const lines = useState<FashionStoreLegacyCartLine[]>(previewCartStateKey, () =>
    initialLines.map((line) => ({ ...line })),
  );
  const count = computed(() => lines.value.reduce((total, line) => total + line.quantity, 0));
  const subtotal = computed(() =>
    lines.value.reduce((total, line) => total + priceAmount(line.price) * line.quantity, 0),
  );

  function add(line: FashionStoreLegacyCartLine): void {
    const existing = lines.value.find(({ variantId }) => variantId === line.variantId);
    if (existing) {
      update(existing.variantId, existing.quantity + line.quantity);
      return;
    }
    lines.value = [...lines.value, lineWithQuantity(line, line.quantity)];
  }

  function remove(variantId: string): void {
    lines.value = lines.value.filter((line) => line.variantId !== variantId);
  }

  function update(variantId: string, quantity: number): void {
    const normalizedQuantity = Math.min(20, Math.max(1, Math.floor(quantity)));
    lines.value = lines.value.map((line) =>
      line.variantId === variantId ? lineWithQuantity(line, normalizedQuantity) : line,
    );
  }

  return { add, count, lines, remove, subtotal, update };
}
