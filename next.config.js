/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Increase body size limit for uploads if needed, but Next.js API config handles that per route usually.
  // We'll handle it in the API route config.
};

module.exports = nextConfig;
