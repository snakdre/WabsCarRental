/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // Server actions default to a 1 MB body. Customer document uploads
      // (lib/actions/account.ts) accept files up to 10 MB plus form overhead.
      bodySizeLimit: "11mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
