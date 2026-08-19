export const fashionStoreLiveCapabilities = Object.freeze({
  account: false,
  articleComments: false,
  catalogSearch: true,
  contactSubmission: false,
  newsletter: false,
  productCompare: false,
  productQuestion: false,
  productQuickView: true,
  productShare: true,
  reviews: false,
  wishlist: false,
});

export type FashionStoreLiveCapability = keyof typeof fashionStoreLiveCapabilities;
