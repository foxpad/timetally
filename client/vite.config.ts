import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
   build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        calendar: 'calendar.html'
      }
    }
  },
  plugins: [react()],
  server: {
    host: true, // или '0.0.0.0'
    allowedHosts: ['59f74413ea67.ngrok-free.app'], // ← сюда добавляешь свой домен
  },
  optimizeDeps: {
    include: ['framer-motion'],
  },
});
