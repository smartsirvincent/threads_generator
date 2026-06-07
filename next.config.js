/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['exceljs', '@anthropic-ai/sdk'],
  },
};

export default nextConfig;
