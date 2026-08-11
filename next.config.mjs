/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['youtube-dl-exec', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
  },
};

export default nextConfig;
