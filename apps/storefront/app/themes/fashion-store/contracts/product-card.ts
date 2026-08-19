/**
 * Explicit compatibility input for source-parity preview product cards.
 * Live commerce cards consume PresentationViewModel instead; FS-U10 owns
 * replacing this compatibility branch with one normalized card ViewModel.
 */
export interface FashionStoreLegacyProductCard {
  badge?: "Hot" | "New";
  categories: readonly string[];
  colors: readonly string[];
  id: string;
  name: string;
  originalPrice: string;
  price: string;
  sizes: readonly string[];
  sourceImage: string;
  tags: readonly string[];
}
