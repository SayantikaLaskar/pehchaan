import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Let phones on the same Wi-Fi open the dev server by the laptop's IP (offline relay demo).
  allowedDevOrigins: ["10.150.24.70", "*.trycloudflare.com"],
};

export default nextConfig;
