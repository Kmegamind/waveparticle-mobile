import type { NextConfig } from "next";

/**
 * Sent with every response (#119 review I1). A link or request to another site gets only this
 * site's origin, never the path or the query, which can hold a Goal or session id; on this site
 * the full address is kept, which Next.js and the sign-in flow may rely on. The S1 next-action
 * request sends no referrer at all (`NEXT_ACTION_REQUEST`).
 */
export const REFERRER_POLICY = "strict-origin-when-cross-origin";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: REFERRER_POLICY }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
