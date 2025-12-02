import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Aseguramos que Vite trate la app como SPA para habilitar el fallback
  appType: 'spa',
  // Usar rutas relativas en producción para cargar desde archivo en Electron
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/test/setup.ts',
  },
  server: {
    host: true,
    port: 7001,
    strictPort: true,
    // Reducir ruido de HMR y evitar overlays por recargas en caliente
    hmr: {
      overlay: false,
    },
    // En Windows, el polling puede mejorar la estabilidad del HMR
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7000',
        changeOrigin: true,
      },
      '/exports': {
        target: 'http://127.0.0.1:7000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@headlessui/react', '@heroicons/react'],
          utils: ['axios', 'date-fns', 'zustand'],
          charts: ['recharts'],
          xlsx: ['xlsx', 'papaparse'],
          pdf: ['jspdf', 'html2canvas'],
          barcode: ['jsbarcode'],
          qrcode: ['qrcode'],
          zxing: ['@zxing/browser', '@zxing/library'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
