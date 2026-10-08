import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // The app lives at hisapo.com/app/; the landing page (landing/) is copied to the site root after the build.
  build: { outDir: 'dist/app', emptyOutDir: true },
  plugins: [react(), tailwindcss()],
  test: { setupFiles: ['src/test-setup.js'] },
  server: {
    host: true, // allow local network access so user can open on mobile phone!
    port: 5173
  }
})

