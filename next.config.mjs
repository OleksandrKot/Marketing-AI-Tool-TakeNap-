/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disables double useEffect calls in dev mode
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
