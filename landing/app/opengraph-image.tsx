import { ImageResponse } from "next/og";

export const alt = "DealUp — Vérifie l’appareil avant de l’acheter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "radial-gradient(circle at 83% 18%, rgba(126, 255, 78, .3), transparent 25%), linear-gradient(135deg, #003525 0%, #001912 58%, #000d09 100%)",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          overflow: "hidden",
          padding: "70px 82px",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 42, fontWeight: 800, letterSpacing: "-2px" }}>
            Deal<span style={{ color: "#bafd23" }}>Up</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 72, fontWeight: 800, letterSpacing: "-4px", lineHeight: 0.98, marginTop: 60 }}>
            Vérifie l’appareil <span style={{ color: "#bafd23" }}>avant</span> de l’acheter.
          </div>
          <div style={{ color: "rgba(239, 250, 243, .7)", fontSize: 25, lineHeight: 1.4, marginTop: 30 }}>
            Prix, photos, preuves, risques et plan d’action.
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(145deg, #38d56e, #008655 58%, #bafd23)",
            border: "3px solid rgba(227, 255, 209, .7)",
            borderRadius: 72,
            boxShadow: "0 35px 80px rgba(0,0,0,.35)",
            display: "flex",
            height: 270,
            justifyContent: "center",
            transform: "rotate(4deg)",
            width: 270,
          }}
        >
          <div
            style={{
              background: "linear-gradient(145deg, #8cff54, #05aa61 55%, #efff31 56%)",
              border: "3px solid rgba(255,255,255,.65)",
              borderRadius: "46px 46px 46px 20px",
              display: "flex",
              height: 150,
              transform: "rotate(-5deg)",
              width: 150,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
