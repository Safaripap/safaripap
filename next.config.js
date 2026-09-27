/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['nostr-tools'],
  },
}

module.exports = nextConfig
