import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The sidebar's BrandMark on white, for home-screen bookmarks (iOS doesn't use SVG icons). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <svg viewBox="0 0 32 32" width="132" height="132">
          <path
            d="M16 3c7.2 0 13 5.3 13 12.2 0 6.8-5.8 12.2-13 12.2-1.7 0-3.3-.3-4.8-.8L5.6 29a1 1 0 0 1-1.4-1.1l1.2-5.1A11.7 11.7 0 0 1 3 15.2C3 8.3 8.8 3 16 3Z"
            fill="#7d68f9"
          />
          <path d="M17.6 8.2 11 16.6h4.3l-1.1 7.2 6.8-8.9h-4.4l1-6.7Z" fill="#ffffff" />
        </svg>
      </div>
    ),
    size
  );
}
