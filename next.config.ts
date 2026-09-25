import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    // 75 for feed media (next/image's default), 100 for the auth banner.
    qualities: [75, 100],

    remotePatterns: [
      {
        hostname: "6e6qr7xlss.ufs.sh",
      },
      // Sample photos from `pnpm db:seed:feed`; never needed in production.
      ...(process.env.NODE_ENV === "production"
        ? []
        : [{ hostname: "fastly.picsum.photos" }]),
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
