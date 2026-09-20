import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The same mark as `icon.svg`, rasterised for iOS home screens.
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="120" height="120">
  <path d="M4.5 14.5h3l2-5 2.6 8 2-6 1.5 3h3.4" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#242cc7",
        }}
      >
        <img
          alt=""
          width={120}
          height={120}
          src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`}
        />
      </div>
    ),
    size,
  );
}
