import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Aseguramos que Vite trate la app como SPA para habilitar el fallback
  appType: 'spa',
  // Usar rutas relativas en producción para cargar desde archivo en Electron
  base: './',
  
  // 🚨 CONFIGURACIÓN ESPECIAL PARA MODO OFFLINE ABSOLUTO
  define: {
    'import.meta.env.VITE_FORCE_OFFLINE': JSON.stringify('true'),
    'import.meta.env.VITE_BLOCK_ALL_REQUESTS': JSON.stringify('true'),
    'import.meta.env.VITE_OFFLINE_MODE': JSON.stringify('true'),
    'import.meta.env.VITE_PREFERRED_DRIVER': JSON.stringify('invoke'),
    'import.meta.env.VITE_FALLBACK_TO_HTTP': JSON.stringify('false'),
    'import.meta.env.VITE_USE_MOCKS': JSON.stringify('true'),
    'import.meta.env.VITE_MOCK_ALL_REQUESTS': JSON.stringify('true'),
  },
  
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    // Deshabilitar completamente el proxy en modo offline
    proxy: {},
    // Reducir ruido de HMR y evitar overlays por recargas en caliente
    hmr: {
      overlay: false,
    },
    // En Windows, el polling puede mejorar la estabilidad del HMR
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/main-offline-absoluto.tsx')
      },
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
    },
  },
})