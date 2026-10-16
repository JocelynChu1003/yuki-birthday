import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const here = import.meta.dirname ?? process.cwd();

/**
 * 正式打包：产物直接落在项目根目录的 preview/ 里。
 * 用 preview/ 而不是 dist/，是为了避开 macOS 自己塞进去的 .DS_Store
 * （它会让打包在中途报“Operation not permitted”而失败）。
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'preview',
    emptyOutDir: true,
    rollupOptions: { input: resolve(here, 'index.html') }
  }
});
