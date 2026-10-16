import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const here = import.meta.dirname ?? process.cwd();

/**
 * 发布到 GitHub Pages 用的打包配置。
 *
 * 和本地预览版的区别只有一个：base（资源根路径）。
 * GitHub Pages 的网址长这样：https://用户名.github.io/仓库名/
 * 所以资源要从 /仓库名/ 开始找，否则打开就是一片空白。
 *
 * 仓库名不用手改：打包时自动读取环境变量 GITHUB_REPOSITORY（Actions 会自带，
 * 形如 "用户名/仓库名"），取后半段当仓库名。本地手动打包时可以用
 *   PAGES_BASE=/仓库名/ npm run pages
 * 来指定；什么都不给就按根路径打包。
 */
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.PAGES_BASE || (repo ? `/${repo}/` : '/');

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: 'pages-dist',
    emptyOutDir: true,
    rollupOptions: { input: resolve(here, 'index.html') }
  }
});
