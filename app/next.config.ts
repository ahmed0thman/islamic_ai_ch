import type { NextConfig } from "next";

const server = process.env.HUDA_ASK === "1" || process.env.HUDA_WEAVE === "1";
const config: NextConfig = {
  ...(server ? {} : {
    output: "export" as const,
    // All reader pages use TSX. Exclude server-only route.ts, proxy.ts and the sign-in pages (page.ts) from static builds.
    pageExtensions: ["tsx", "jsx", "js"],
  }),
  // Sign-in (Clerk) needs a server and its keys. With either missing the flag is off: no Clerk code is bundled or run.
  env: { NEXT_PUBLIC_HUDA_AUTH: server && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "1" : "" },
  // Loaded by the server at run time, not bundled (Postgres client and the local embedding model).
  serverExternalPackages: ["pg", "@huggingface/transformers", "onnxruntime-node"],
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default config;
