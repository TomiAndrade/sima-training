import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Proxy de DEMO: la app y la API salen por el MISMO origen, así alcanza con un
// solo tunel HTTPS (cloudflared) y no hay CORS que configurar. Con VITE_API_URL
// vacio, BASE_URL queda en '' y todos los fetch salen relativos (/tablet/...,
// /uploads/...), que es lo que estas reglas mandan al backend local.
const proxyDemo = {
  '/tablet': 'http://localhost:3000',
  '/uploads': 'http://localhost:3000',
  '/auth': 'http://localhost:3000',
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,webmanifest}',
          'icons/*.png',
          'apple-touch-icon.png',
          'favicon.svg',
          'SIMA_CHECK-logo.png',
          'SIMACHECK-FONDO.webp',
        ],
        navigateFallback: 'index.html',
      },
      manifest: {
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'SIMA CHECK',
        short_name: 'SIMA CHECK',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#dc2626',
        lang: 'es',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // para probar la PWA desde una tablet vía túnel HTTPS (cloudflared)
  //
  // Va en los DOS bloques a propósito: `preview` sirve el build de producción
  // (que es donde la PWA existe de verdad) y `server` el dev server. Vite valida
  // el header Host en los dos, así que con `allowedHosts` sólo en `preview` un
  // `npm run dev` detrás del túnel se cae con "This host is not allowed".
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: proxyDemo,
  },
  preview: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: proxyDemo,
  },
})
