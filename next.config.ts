import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "three-csg-ts",
  ],
  // Turbopack (Next.js 16 default) — empty config silences the warning
  turbopack: {},
  // Webpack fallback kept for `next build --webpack` if WASM is needed
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
