export function orderAccessAssetPath(pathname: string): string {
  return /^\/orders\/[^/]+\/?$/.test(pathname) &&
    pathname !== "/orders/access" &&
    pathname !== "/orders/access/"
    ? "/orders/access/"
    : pathname;
}
