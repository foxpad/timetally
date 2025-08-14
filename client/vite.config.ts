import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // или '0.0.0.0'
    allowedHosts: ['bb7a85aa2ac1.ngrok-free.app'], // ← сюда добавляешь свой домен
  },
  optimizeDeps: {
    include: ['framer-motion'],
  },
});
