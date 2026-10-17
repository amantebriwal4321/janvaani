import type { NextRequest } from "next/server";

// Tunnel diagnostic: GET /api/diag?kb=N returns exactly N kilobytes of plain
// text with an explicit Content-Length (no chunked encoding, no compression).
// Open it with increasing N in the browser to find the size at which a
// proxy/port-forward starts truncating responses. Capped at 8 MB.
const MAX_KB = 8192;
const LINE = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-.\n"; // 64 bytes

export function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("kb") ?? "1");
  const kb = Number.isFinite(raw) ? Math.min(MAX_KB, Math.max(1, Math.floor(raw))) : 1;
  const header = `JanVaani tunnel diagnostic: ${kb} KB (${kb * 1024} bytes) follow. Last line reads END.\n`;
  const total = kb * 1024;
  const bodyLen = total - header.length;
  // Leave at least 4 bytes for the END marker so the body is exactly `total` bytes.
  const lines = Math.floor((bodyLen - 4) / LINE.length);
  const tail = bodyLen - lines * LINE.length;
  const body = header + LINE.repeat(lines) + "END\n".padStart(tail, "=");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(body)),
      "Cache-Control": "no-store",
      "X-Diag-KB": String(kb),
    },
  });
}
