// JSON with an explicit Content-Length. Response.json() is Transfer-Encoding:
// chunked, and the cloud-agent port forward cuts chunked bodies off. The browser
// then rejects fetch() with TypeError "Failed to fetch" even though the handler
// finished. /api/health and /api/diag already send a length for this reason.
export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
  const body = JSON.stringify(data);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(body)),
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
