import { ImageResponse } from "next/og";

export const alt = "Reenite: business registration, tax and online presence for Nigerian businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview card shown when a Reenite link is shared on WhatsApp, Facebook, X or LinkedIn. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#10152c", padding: 80, color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="67" viewBox="0 0 1195 1256">
            <circle cx="585" cy="230" r="230" fill="white" />
            <circle cx="230" cy="635" r="230" fill="white" />
            <circle cx="585" cy="1026" r="230" fill="white" />
            <polygon points="692,635 1060,268 1195,404 963,635 1195,869 1060,1004" fill="#F05A28" />
          </svg>
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>reenite</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>Building a business?</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            Don&apos;t build&nbsp;<span style={{ color: "#F05A28" }}>alone.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#c3c8dc" }}>CAC registration, tax filing and online presence, handled by our legal experts.</div>
        </div>
        <div style={{ fontSize: 26, color: "#c3c8dc" }}>reenite.com · Uyo, Akwa Ibom</div>
      </div>
    ),
    size,
  );
}
