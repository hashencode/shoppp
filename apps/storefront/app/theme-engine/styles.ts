import { themeStylesSchema, type PageTemplate } from "@shoppp/contracts";

export function themeStyleCss(input: PageTemplate["styles"]): string {
  if (!input || Object.values(input).every((value) => value === undefined)) return "";
  const styles = themeStylesSchema.parse(input);
  const fonts = { figtree: '"Figtree", sans-serif', outfit: '"Outfit", sans-serif' };
  const declarations = [
    styles.accent && `--base-color:${styles.accent}`,
    styles.text && `--dark-gray:${styles.text};--medium-gray:${styles.text}`,
    styles.font && `--primary-font:${fonts[styles.font]};--alt-font:${fonts[styles.font]}`,
  ]
    .filter(Boolean)
    .join(";");
  const prefix = "html[data-shoppp-theme-styles]";
  return (
    `${prefix}{${declarations}}` +
    `${prefix} body{${styles.background ? `background-color:${styles.background};` : ""}${styles.text ? `color:${styles.text};` : ""}${styles.font ? `font-family:${fonts[styles.font]};` : ""}}` +
    (styles.font
      ? [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "input",
          "select",
          "textarea",
          "button",
          ".btn",
          ".alt-font",
          ".primary-font",
        ]
          .map((selector) => `${prefix} ${selector}{font-family:${fonts[styles.font!]}!important}`)
          .join("")
      : "") +
    (styles.buttonRadius !== undefined
      ? `${prefix} .btn,${prefix} button[type=submit]{border-radius:${styles.buttonRadius}px!important}`
      : "") +
    (styles.spacing !== undefined
      ? `${prefix} .site-shell>*+*{margin-top:${styles.spacing}px!important}${prefix} .site-shell main>section+section{margin-top:${styles.spacing}px!important}`
      : "")
  );
}
