import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    // This proxy is the key to connecting to your Go backend during development.
    // It tells the Vite dev server to forward any requests to /ws
    // to your Go server running on localhost:8080.
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true, // This is essential for WebSocket proxying
      },
    },
  },
});
