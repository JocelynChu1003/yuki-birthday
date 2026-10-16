import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const here = import.meta.dirname ?? process.cwd();

/**
 * 发布到 Netlify 用的打包配置。
 *
 * Netlify 会把网站放在网址根目录（比如 https://xxx.netlify.app/），
 * 所以这里用相对路径 base（'./'）—— 无论在哪个路径下都能正确找到资源，
 * 比写死域名或仓库名更稳。
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'netlify-dist',
    emptyOutDir: true,
    rollupOptions: { input: resolve(here, 'index.html') }
  }
});
