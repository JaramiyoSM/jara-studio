import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { watch: { ignored: ['**/artifacts/**', '**/release/**'] } },
  build: {
    sourcemap: false,
    target: 'chrome134',
    rollupOptions: {
      output: { manualChunks: { three: ['three'], react: ['react', 'react-dom'] } },
    },
  },
});
