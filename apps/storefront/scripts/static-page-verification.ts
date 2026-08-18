export function assertStaticPageHtml(input: {
  html: string;
  previewBuild: boolean;
  route: string;
}): void {
  const { html, previewBuild, route } = input;
  if (!html.includes('<link rel="canonical"') || !html.includes("<h1")) {
    throw new Error(`${route} is missing canonical metadata or meaningful static content.`);
  }
  if (previewBuild && !/<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/.test(html)) {
    throw new Error(`${route} preview HTML must be non-indexable.`);
  }
  if (
    previewBuild &&
    (!/<link[^>]+rel="stylesheet"[^>]+href="\/_nuxt\/[^"]+\.css"/.test(html) ||
      /<style\b/i.test(html))
  ) {
    throw new Error(`${route} preview CSS must remain external and cacheable.`);
  }
}
