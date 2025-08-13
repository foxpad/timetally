import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // или '0.0.0.0'
    allowedHosts: ['b0b3cdcc21c3.ngrok-free.app'], // ← сюда добавляешь свой домен
  },
  optimizeDeps: {
    include: ['framer-motion'],
  },
});
