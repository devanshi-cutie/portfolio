import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Local media, the seed's compression cache and reference material never ship.
  outputFileTracingExcludes: {
    "*": ["./data/**", "./.seed-cache/**", "./reference/**"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  poweredByHeader: false,
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      // The public site may not be framed by other sites (clickjacking).
      { source: "/:path*", headers: [...base, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      // The admin may not be framed at all. (The Cloudinary upload widget is an
      // iframe *inside* the admin, which frame-ancestors does not restrict.)
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
