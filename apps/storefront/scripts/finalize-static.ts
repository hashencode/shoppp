import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(import.meta.dir, "../.output/public");
await rm(resolve(output, "200.html"), { force: true });
await writeFile(
  resolve(output, "404.html"),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Page not found | Shoppp</title>
  <style>
    :root{color:#10201b;background:#f6f3ec;font-family:Inter,system-ui,sans-serif}
    body{margin:0}.header{height:74px;padding:0 5vw;display:flex;align-items:center;border-bottom:1px solid #10201b29}
    .brand{font-weight:900;letter-spacing:-.05em;font-size:1.35rem;color:inherit;text-decoration:none}
    main{min-height:70vh;display:grid;place-content:center;text-align:center;padding:2rem}
    strong{font-size:clamp(6rem,24vw,15rem);letter-spacing:-.1em;line-height:.72}
    h1{font-size:clamp(2rem,5vw,4rem);margin:.8rem 0}.cta{color:white;background:#10201b;padding:.9rem 1.2rem;border-radius:99px;text-decoration:none;justify-self:center}
  </style>
</head>
<body>
  <header class="header"><a class="brand" href="/">SHOPPP</a></header>
  <main><strong aria-hidden="true">404</strong><h1>Page not found</h1><p>The requested page does not exist or has moved.</p><a class="cta" href="/">Return home</a></main>
</body>
</html>
`,
);
