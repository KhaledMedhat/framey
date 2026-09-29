import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    // 75 is next/image's default, 90 for post media (already a WebP 90 from
    // the upload route, so a lower second encode would visibly soften it),
    // 100 for the auth banner.
    qualities: [75, 90, 100],

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
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No framing: stops clickjacking the like/follow/delete buttons.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
