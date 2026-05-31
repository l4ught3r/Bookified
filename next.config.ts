import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "playwright",
    "cheerio",
    "@lingo-reader/epub-parser",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "radix-ui"],
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "cdn.simpleicons.org" },
    ],
  },
};

export default withNextIntl(nextConfig);
