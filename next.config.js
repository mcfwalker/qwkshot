/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static asset handling
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000',
  // Ensure images can be loaded from Supabase
  images: {
    domains: ['mmoqqgsamsewsbocqxbi.supabase.co'],
  },
  // Position for dev indicators
  devIndicators: {
    position: 'bottom-right',
  },
  // Support external packages for server components
  serverExternalPackages: ['@supabase/auth-helpers-nextjs'],
}

module.exports = nextConfig 