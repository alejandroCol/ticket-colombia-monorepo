import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Workbox (vite-plugin-pwa) crea archivos temporales bajo el TMP del sistema.
 * En sandboxes o políticas restrictivas eso puede fallar con EACCES; usamos un tmp local.
 */
const pwaBuildTmp = path.join(__dirname, '.pwa-build-tmp')
try {
  fs.mkdirSync(pwaBuildTmp, { recursive: true })
  process.env.TMPDIR = pwaBuildTmp
  process.env.TMP = pwaBuildTmp
  process.env.TEMP = pwaBuildTmp
} catch {
  // Si falla, Workbox seguirá con el tmp por defecto del SO
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Ticket Colombia — Taquilla',
        short_name: 'Taquilla',
        description: 'Escanear y validar boletos (modo taquilla)',
        theme_color: '#0d1b2a',
        background_color: '#0d1b2a',
        display: 'standalone',
        start_url: '/scan-tickets',
        scope: '/',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@containers': path.resolve(__dirname, './src/containers'),
      '@TopNavBar': path.resolve(__dirname, './src/containers/TopNavBar'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
})
