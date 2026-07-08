import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
