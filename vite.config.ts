import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    // Warn only for very large chunks
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split into separate cached chunks — browser only re-downloads what changed
        manualChunks: {
          'vendor-react':  ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons':  ['lucide-react'],
          'vendor-socket': ['socket.io-client', 'simple-peer'],
          'vendor-ai':     ['@google/genai'],
        },
        // Stable filenames for long-term browser caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    // Minify with esbuild (default) — fast + effective
    minify: 'esbuild',
    // Inline tiny assets to save HTTP round-trips
    assetsInlineLimit: 4096,
  },
  server: { port: 3000 },
  // Pre-bundle heavy deps at dev startup — no re-bundling per page load
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'lucide-react'],
  },
});
