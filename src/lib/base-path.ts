// Static-asset base path for GitHub Pages sub-path deployment.
// Matches next.config.ts's basePath (empty locally, "/<repo>" in CI).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
