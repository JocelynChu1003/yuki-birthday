#!/bin/zsh
set -e
PROJECT_DIR="/Users/xiaowangzi/Documents/Codex/2026-10-17/codex-text-yuki-chu-2002-10"
RUNTIME_DIR="/Users/xiaowangzi/.cache/codex-runtimes/codex-primary-runtime/dependencies"

cd "$PROJECT_DIR"
export PATH="$RUNTIME_DIR/node/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js。请在 Codex 中重新打开这个项目后再试。"
  read "?按回车键关闭…"
  exit 1
fi

# 每次双击都会先重新打包，再打开网站，所以看到的永远是最新版本。
"$RUNTIME_DIR/bin/fallback/pnpm" run fresh &
SERVER_PID=$!
sleep 6
open "http://localhost:5180/"
echo "网站已打开。保持此窗口不要关闭；关闭窗口即停止网站。"
wait $SERVER_PID
