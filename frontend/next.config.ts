import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow all local network origins for HMR and mobile/Wi-Fi access
  allowedDevOrigins: [
    "10.54.25.52",
    "10.54.25.52:3000",
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "slow-taxis-leave.loca.lt",
  ],
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
