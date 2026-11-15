# Environment — Храбрый Воробей
VERIFIED: yes
## Installed
- Node.js 25.9.0; npm 11.12.1; Git; Google Chrome.
- Playwright 1.62.1: bundled Codex runtime (локальная проверка, не зависимость игры).
- Python: C:/Users/alexei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe
## Agent integrations
- Browser QA: Playwright + Chrome, desktop и mobile viewport, ошибки JS и мультитач.
- Native Canvas/WebAudio не требует редактора игрового движка или его MCP.
## Commands
RUN: node scripts/serve.mjs
TEST: npm.cmd test
BUILD: node scripts/build.mjs
CAPTURE: node .runtime/browser-check.cjs
EDITOR: code .
## Pitfalls
- CAPTURE — локальный QA-скрипт текущего рабочего окружения; требует запущенного RUN на порту 4173.
- Sandbox Windows требует разрешения на запуск Chrome и запись .git.
- Запуск доступен на localhost:4173 и в локальной сети по IP компьютера.
- Реальный iPhone/Android ещё не проверен.
- Аудиопроверка текущего окружения: node .runtime/audio-variants.cjs (все темы/голоса, прослушивание, сохранение выбора, mute/pause, отмена отложенного resume, мобильное окно).
