import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: true,
    watch: {
      ignored: ['**/release/**', '**/electron-compiled/**', '**/node_modules/**'],
    },
  },
  build: {
    outDir: 'dist',
  },
})
