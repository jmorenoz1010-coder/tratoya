import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fix: recharts v3 + Vite 8 CommonJS/ESM compatibility
  optimizeDeps: {
    include: ['recharts', 'recharts/lib/component/DefaultTooltipContent'],
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_API_URL || 'https://api.tratoya.com',
        changeOrigin: true,
      },
    },
  },
})
