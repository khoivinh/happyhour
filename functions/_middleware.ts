/// <reference types="@cloudflare/workers-types" />
//
// Cloudflare Pages Function — the first (and only) edge code on Happyhour's HTML-serving path.
//
// Why it exists: Happyhour is a static SPA, so every shared link (`/?z=…`) is served the same
// index.html with the same generic OG tags. Social crawlers (iMessage, Slack, Facebook, X…) don't
// run JS, so they'd all preview identically. This rewrites the head's social meta per-share — naming
// the shared cities and distinguishing a live share from a frozen time-zone conversion — while
// leaving the page itself untouched (the SPA ignores its own meta at runtime). The preview image
// stays the static og.png; only text is dynamic.
//
// It runs on every request but does real work only for the share document: no `?z=` or a non-HTML
// request returns immediately without buffering the response.

import { buildPreview } from "./lib/preview";

export const onRequest: PagesFunction = async ({ request, next }) => {
  const url = new URL(request.url);
  const z = url.searchParams.get("z");
  const accept = request.headers.get("accept") || "";

  // Only the share document, and only requests that want HTML (crawlers and browsers both send
  // Accept: text/html for the page; asset requests don't). Everything else is served untouched.
  if (!z || !accept.includes("text/html")) return next();

  const response = await next();
  if (!(response.headers.get("content-type") || "").includes("text/html")) return response;

  const { title, description } = buildPreview(z, url.searchParams.get("t"));
  const setContent = (value: string) => ({
    element(el: Element) {
      el.setAttribute("content", value);
    },
  });

  // HTMLRewriter streams and escapes for us — no manual entity-encoding needed.
  return new HTMLRewriter()
    .on('meta[property="og:title"]', setContent(title))
    .on('meta[name="twitter:title"]', setContent(title))
    .on('meta[property="og:description"]', setContent(description))
    .on('meta[name="twitter:description"]', setContent(description))
    .on('meta[property="og:url"]', setContent(url.toString()))
    .on("title", {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .transform(response);
};
