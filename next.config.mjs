/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Gzip-compress JSON responses (gains ~10× on /api/retell/calls).
  // Vercel adds Brotli for static assets but not for dynamic routes,
  // so we enable Next's built-in compression to cover the API layer.
  compress: true,
}

export default nextConfig
