
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      { // This entry is being restored
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  // Add the allowedDevOrigins configuration for development
  // This is useful when running Next.js dev server behind a proxy or in environments like Cloud Workstations
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      allowedDevOrigins: [
        'https://9000-firebase-studio-1748639070372.cluster-pgviq6mvsncnqxx6kr7pbz65v6.cloudworkstations.dev',
        // You might need to add other variations if the port or protocol changes,
        // or if the specific part of the URL causing the issue is slightly different.
        // For example, sometimes the port is not included in the origin string reported.
      ],
    },
  }),
};

export default nextConfig;
    