/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    // Make Sentry optional - don't fail build if it's not installed
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@sentry/nextjs': 'commonjs @sentry/nextjs',
      });
    }
    return config;
  },
}

module.exports = nextConfig

