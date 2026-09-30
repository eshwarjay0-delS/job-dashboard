import { ImageResponse } from "next/og"

// Branded social share card (LinkedIn / X / iMessage). 1200×630.
export const alt = "MarketFit — Own Your Next Role"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "linear-gradient(135deg,#13120d 0%,#1c1b15 55%,#13120d 100%)",
          color: "#f4f2ed",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 34 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(145deg,#6e6b5b,#5b594e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            MF
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#d3cdc0" }}>MarketFit</div>
        </div>

        <div style={{ display: "flex", fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-2px" }}>
          Own your next role.
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#9d9884", marginTop: 26, maxWidth: 900, lineHeight: 1.4 }}>
          Tailor resumes in 12s · autofill any application in one click · find visa-friendly jobs.
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 42 }}>
          <div style={{ display: "flex", fontSize: 22, color: "#9d9884", fontWeight: 600, border: "1px solid #3a3a36", borderRadius: 999, padding: "8px 22px" }}>
            H-1B · OPT · CPT
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#bbb5a5", fontWeight: 600, border: "1px solid #484740", borderRadius: 999, padding: "8px 22px" }}>
            AI resume tailoring
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
