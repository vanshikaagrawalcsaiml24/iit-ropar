import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.56.1'],
  serverExternalPackages: ['onnxruntime-node', '@xenova/transformers'],
};

export default nextConfig;
