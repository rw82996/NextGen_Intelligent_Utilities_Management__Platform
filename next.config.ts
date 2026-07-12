import type { NextConfig } from "next";

// On GitHub Actions we deploy to GitHub Pages under /<repo>/; locally we serve at /.
const repo = "NextGen_Intelligent_Utilities_Management__Platform";
const isCI = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: isCI ? `/${repo}` : "",
  assetPrefix: isCI ? `/${repo}/` : "",
  trailingSlash: true,
  // Exposed to client bundles so runtime fetch() calls (models, workers-of-workers,
  // anything not routed through next/link or next/image) can prefix static asset URLs.
  env: {
    NEXT_PUBLIC_BASE_PATH: isCI ? `/${repo}` : "",
  },
};

export default nextConfig;
