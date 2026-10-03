import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server only — ignored in production builds. Lets a phone on the same
  // Wi-Fi open the site at the laptop's address (e.g. http://192.168.0.107:3000)
  // to test UPI payments. Without it, Next.js blocks the live-reload connection
  // from that address and keeps reloading the page, which aborts form submits.
  allowedDevOrigins: ["192.168.*.*"],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/breaktheice',
        permanent: false, // Temporary redirect
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'cdn2.allevents.in',
      },
    ],
  },
};

export default nextConfig;
