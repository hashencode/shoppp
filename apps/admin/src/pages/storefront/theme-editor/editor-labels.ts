import type { PageTemplate } from '@shoppp/contracts'

export const editorPageLabels: Record<PageTemplate['pageType'], string> = {
  home: 'Home',
  collection: 'Collection',
  product: 'Product',
  content: 'Content',
  cart: 'Cart',
  checkout: 'Checkout',
  order: 'Order',
  policy: 'Policy',
}
export const editorRegionLabels: Record<string, string> = {
  'fashion-store.hero': 'Hero',
  'fashion-store.hero-slide': 'Hero slide',
  'fashion-store.services': 'Services',
  'fashion-store.service': 'Service',
  'fashion-store.categories': 'Categories',
  'fashion-store.category': 'Category',
  'fashion-store.products': 'Products',
  'fashion-store.promotion': 'Promotion',
  'fashion-store.collection-feature': 'Featured collection',
  'fashion-store.brand-strip': 'Brands',
  'fashion-store.brand': 'Brand',
  'fashion-store.marquee': 'Marquee',
  'fashion-store.marquee-item': 'Marquee item',
  'fashion-store.editorial': 'Editorial',
  'fashion-store.editorial-card': 'Editorial card',
  'fashion-store.product-merchandising': 'Product groups',
}
export const editorRegionName = (type: string) =>
  editorRegionLabels[type] ?? type.replace(/^(fashion-store|core)\./, '').replaceAll('-', ' ')
