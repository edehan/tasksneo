import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const monorepoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    webpackMemoryOptimizations: true, // 减少最大内存使用量
  },
  env: {
    INSTRUMENTATION_SCRIPT_URLS: process.env.INSTRUMENTATION_SCRIPT_URLS || "",
  },
};

export default withNextIntl(nextConfig);
