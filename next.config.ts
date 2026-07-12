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
};

export default nextConfig;
