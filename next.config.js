/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["poker-calculations"],
  // The poker project was "Poker-Bot" at /projects/poker-bot; it carries its
  // package's name now. Old links land on the new page.
  async redirects() {
    return [{ source: "/projects/poker-bot", destination: "/projects/poker-calculations", permanent: true }];
  },
  // The Card Sum Options Desk is priced by a Python Function (api/carddesk.py)
  // that Vercel serves at /api/carddesk in production. `next dev` knows nothing
  // about it, so in development the same path is proxied to the local stand-in
  // started by `pnpm dev:desk`.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/api/carddesk", destination: "http://127.0.0.1:8001/api/carddesk" }];
  },
};

module.exports = nextConfig;
