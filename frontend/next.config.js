/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["ws"],
  },
  env: {
    NEXT_PUBLIC_HIRO_API_URL: process.env.NEXT_PUBLIC_HIRO_API_URL || "https://api.hiro.so",
    NEXT_PUBLIC_CONTRACT_DEPLOYER: process.env.NEXT_PUBLIC_CONTRACT_DEPLOYER || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  },
};

module.exports = nextConfig;
