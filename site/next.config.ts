import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ipfs.dweb.link" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
    ],
  },
};

export default nextConfig;

