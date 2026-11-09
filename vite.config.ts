import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'myRheumApp — Personal Rheumatology Health Journal',
        short_name: 'myRheumApp',
        description:
          'Private, offline-aware rheumatology symptom, medication, laboratory and appointment journal.',
        theme_color: '#101C2B',
        background_color: '#F7F8FB',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/dashboard',
        scope: '/',
        categories: ['health', 'medical', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Daily check-in', url: '/health-journal' },
          { name: 'Medications', url: '/medications' },
          { name: 'Appointments', url: '/appointments' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/functions\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'anatomy-models',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
  },
})
