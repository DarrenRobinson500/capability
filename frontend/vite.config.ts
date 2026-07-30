import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Only prefix asset URLs with /static/ for production builds (so Django's
  // whitenoise-served STATIC_URL matches). The dev server serves from root.
  base: command === 'build' ? '/static/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    outDir: '../backend/frontend_dist',
    emptyOutDir: true,
  },
}))
