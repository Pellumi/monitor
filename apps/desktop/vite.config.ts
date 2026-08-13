import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/renderer',
  base: './',
  server: { port: 5174, strictPort: true },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
});
