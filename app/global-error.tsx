"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18 }}>JanVaani could not start</h1>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#fff7e6", border: "1px solid #f5c76b", padding: 12, borderRadius: 8 }}>
          {error.message || "Unknown error"}{error.digest ? `\n(digest ${error.digest})` : ""}
        </pre>
        <button onClick={reset} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #999", cursor: "pointer" }}>Try again</button>
      </body>
    </html>
  );
}
