import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/momcomfort",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
