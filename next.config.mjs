/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the single Railway container.
  output: "standalone",
  experimental: {
    instrumentationHook: true,
    serverActions: { bodySizeLimit: "30mb" },
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
