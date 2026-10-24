import type { NextConfig } from "next";

const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  // Used by the static page to fetch the optional published schedule-data.json.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
