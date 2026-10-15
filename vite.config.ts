import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/skuast-k/',
  build: {
    // Keep the first paint light: public QR-shared pages must not force
    // mobile browsers to download the admin-only xlsx/pdf-editing code.
    // (Vite 8 runs on Rolldown: vendor splitting uses codeSplitting.)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-xlsx', test: /node_modules[\\/]xlsx[\\/]/ },
            { name: 'vendor-pdf', test: /node_modules[\\/](jspdf|html2canvas)[\\/]/ },
            { name: 'vendor-qr', test: /node_modules[\\/](qrcode\.react|@zxing)[\\/]/ },
          ],
        },
      },
    },
  },
});