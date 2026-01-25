/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Отключает двойные вызовы useEffect в dev режиме
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
