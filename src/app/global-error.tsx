"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application error", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f7fafc", fontFamily: "Helvetica, Arial, sans-serif", color: "#071f2f" }}>
        <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "24px" }}>
          <div style={{ maxWidth: "32rem", width: "100%", background: "#fff", border: "1px solid #e1ebf1", borderRadius: "20px", padding: "32px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#0e83ab" }}>Knight Medical Billing</div>
            <h1 style={{ margin: "12px 0 0", fontSize: "24px", letterSpacing: "-.02em" }}>We hit an unexpected error</h1>
            <p style={{ margin: "10px 0 0", fontSize: "14px", lineHeight: 1.6, color: "#5b7686" }}>
              Please refresh the page. If the issue continues, call <a href="tel:+18129940046" style={{ color: "#0e83ab", fontWeight: 700 }}>(812) 994-0046</a> or email{" "}
              <a href="mailto:admin@knightmedicalbilling.com" style={{ color: "#0e83ab", fontWeight: 700 }}>admin@knightmedicalbilling.com</a>.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: "20px", background: "#071f2f", color: "#fff", border: 0, borderRadius: "999px", padding: "12px 20px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >
              Reload the page
            </button>
            {error.digest && <p style={{ marginTop: "14px", fontSize: "11px", color: "#9aa9b3" }}>Reference: {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
