/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['youtube-dl-exec', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
    // Ambos binarios los descarga un postinstall, así que ningún import los
    // referencia y el tracer de Next no los copia al bundle de la función.
    // Sin esto el spawn falla con ENOENT en Vercel.
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/youtube-dl-exec/bin/**',
        './node_modules/@ffmpeg-installer/**',
      ],
    },
  },
};

export default nextConfig;
