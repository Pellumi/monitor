import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/renderer',
  envDir: path.resolve(__dirname),
  base: './',
  server: { port: 5174, strictPort: true },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
});
