import type { NextConfig } from "next";

const config: NextConfig = {
  ...(process.env.HUDA_ASK === "1" ? {} : {
    output: "export" as const,
    // All reader pages use TSX. Exclude server-only route.ts from static builds.
    pageExtensions: ["tsx", "jsx", "js"],
  }),
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default config;
