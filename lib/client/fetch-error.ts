// Chrome/Edge: "Failed to fetch". Safari: "Load failed". Firefox: the NetworkError sentence.
// These are TypeError messages from fetch() when the browser never got a response
// (network, CORS, a closed connection, or a chunked body the proxy cut off).
const OPAQUE_FETCH = new Set([
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource.",
  "Network request failed",
]);

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

// Names the call in the amber banner. A harmless abort (timeout, unmount,
// strict-mode cleanup) returns null so the caller leaves the banner alone.
export function fetchBanner(what: string, e: unknown, fallback: string): string | null {
  if (isAbortError(e)) return null;
  const msg = e instanceof Error && e.message ? e.message : fallback;
  return OPAQUE_FETCH.has(msg) ? `${what} failed: ${msg}` : msg;
}
