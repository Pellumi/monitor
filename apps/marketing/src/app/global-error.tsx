"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#000", color: "#fff", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24 }}>
          <div style={{ width: "min(760px, 100%)" }}>
            <p style={{ font: "700 10px monospace", letterSpacing: ".16em", color: "#8e9192" }}>500 / GLOBAL_ERROR</p>
            <h1 style={{ margin: "38px 0 26px", fontSize: "clamp(52px, 8vw, 96px)", letterSpacing: "-.07em", lineHeight: ".88" }}>Tellann couldn’t finish loading.</h1>
            <p style={{ maxWidth: 560, color: "#8e9192", fontSize: 17, lineHeight: 1.7 }}>A critical application error interrupted this page. Retry the request or return to the Tellann home page.</p>
            <div style={{ display: "flex", gap: 9, marginTop: 34, flexWrap: "wrap" }}>
              <button onClick={reset} style={{ padding: "17px 22px", border: "1px solid #fff", background: "#fff", color: "#000", fontWeight: 800, cursor: "pointer" }}>Try again ↻</button>
              <Link href="/" style={{ padding: "17px 22px", border: "1px solid #262626", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Back to home →</Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
