
import type {NextConfig} from 'next';
import type { Configuration as WebpackConfiguration } from 'webpack';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Globally unoptimize images as per previous step
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        // Updated to reflect the new project ID "sipnread" and its likely default storage bucket.
        // If your "sipnread" project uses a custom storage bucket name, you'll need to adjust this.
        pathname: '/v0/b/sipnread.appspot.com/o/**',
      },
    ],
  },
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      allowedDevOrigins: [
        'https://9000-firebase-studio-1748639070372.cluster-pgviq6mvsncnqxx6kr7pbz65v6.cloudworkstations.dev',
      ],
    },
  }),
  webpack: (config: WebpackConfiguration, { isServer, dev }) => {
    // Ensure module and noParse are initialized correctly
    if (!config.module) {
      config.module = { rules: [] };
    }

    // For client-side bundles, prevent Webpack from parsing Handlebars
    // to avoid 'require.extensions' error.
    if (!isServer) {
      const existingNoParse = config.module.noParse;
      let newNoParseArray: (RegExp | string | ((content: string) => boolean))[] = [];

      if (Array.isArray(existingNoParse)) {
        newNoParseArray = [...existingNoParse];
      } else if (existingNoParse) {
        newNoParseArray = [existingNoParse];
      }
      
      // Add handlebars to the noParse array for client bundles only
      if (!newNoParseArray.some(item => item.toString() === /handlebars/.toString())) {
        newNoParseArray.push(/handlebars/);
      }
      config.module.noParse = newNoParseArray;
    }

    // For server-side bundles, ensure Handlebars is correctly processed.
    // We don't want to noParse it on the server if it's causing MODULE_NOT_FOUND.
    // If Handlebars is a commonJS module and causing issues,
    // one common pattern is to ensure it's bundled.
    // However, the MODULE_NOT_FOUND suggests it's not even being picked up.

    // Let's try ensuring it's not externalized if it's being picked up by Genkit tools.
    // Next.js has specific ways of handling server externals.
    // Sometimes, explicit bundling is needed.

    // It's also possible the Genkit tools themselves might need a specific Webpack setup
    // when used within Next.js server components/actions.

    // For now, we'll focus on making sure noParse is client-side only.
    // If the MODULE_NOT_FOUND persists on the server, we might need to look into
    // how Genkit/dotprompt packages Handlebars or if there's a specific way
    // Next.js expects to bundle such dependencies for server actions.

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;

    