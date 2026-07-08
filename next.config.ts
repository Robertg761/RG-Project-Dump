import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.rgprojectdump.ca" }],
        destination: "https://rgprojectdump.ca/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
