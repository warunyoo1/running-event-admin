import type { NextConfig } from "next";

// Browser calls same-origin `/api/v1/...`; Next forwards it to the real API.
// Same-origin keeps the SameSite=Lax auth cookie working over plain HTTP.
const apiProxyTarget = (process.env.API_PROXY_TARGET ?? "http://localhost:4000").replace(/\/+$/, "");

const config: NextConfig = {
  agentRules: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default config;
