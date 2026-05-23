import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5174, // yt-webService utilise 5173 en npm run dev
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3002', ws: true },
    },
  },
});
