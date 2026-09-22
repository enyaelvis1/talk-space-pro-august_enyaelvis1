export const PUBLIC_DOCUMENT_CDN_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

const PUBLIC_DOCUMENT_PATHS = new Set([
  "/",
  "/about",
  "/pricing",
  "/services",
  "/therapists",
  "/blog",
  "/faqs",
  "/terms",
  "/privacy-policy",
  "/cancellation-refund-policy",
  "/emergency-support",
  "/contact",
]);

/**
 * CDN caching is restricted to anonymous, query-free GET document requests.
 * Admin, booking, payment, and tokenized requests must remain private.
 */
export function isPublicDocumentRequest(request: Request): boolean {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (url.search || request.headers.has("cookie")) return false;

  return PUBLIC_DOCUMENT_PATHS.has(url.pathname) || url.pathname.startsWith("/content/");
}
