import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf", "node-tesseract-ocr"],
};

export default nextConfig;
