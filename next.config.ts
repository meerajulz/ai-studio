import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to THIS project. Without it, a stray lockfile in the home directory
  // (~/package-lock.json) makes Next infer `/Users/<you>` as the root and try to scan the whole home
  // folder — which hangs the dev compile. See the "multiple lockfiles" warning on `next dev`.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
