
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Maps the environment variable for both dev and production (Vercel)
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000
  }
});
