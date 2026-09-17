import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    qualities: [100],

    remotePatterns: [
      {
        hostname: "6e6qr7xlss.ufs.sh",
      },
    ],
  },
  serverExternalPackages: ["postgres", "drizzle-orm", "bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
  },
};

export default nextConfig;
