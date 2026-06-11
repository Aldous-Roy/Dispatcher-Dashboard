import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/

// Proxied to live backend hosted in the cloud

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'https://virtusa-logistics.onrender.com',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
