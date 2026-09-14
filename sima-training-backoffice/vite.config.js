import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // El puerto va fijo y con strictPort. Es el default de Vite igual, pero
  // declararlo importa: la app tablet (`sima-check-app`, repo aparte) es otro
  // dev server de Vite, y cuando los dos tomaban el default el segundo en
  // arrancar saltaba solo a 5174 — cuál era cuál dependía del orden. Ahora el
  // backoffice es siempre 5173 y la tablet siempre 5174, y si el puerto está
  // ocupado el server falla en vez de mudarse en silencio.
  server: {
    port: 5173,
    strictPort: true,
  },
})
