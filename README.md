# Чарлист Антар

Один HTML-файл. Откройте `antar-sheet.html` в браузере (двойной клик).

Данные хранятся браузером (localStorage); для переноса между устройствами: **Экспорт** (JSON) → на другом устройстве **Импорт** того же файла.

## Разработка

- `npm test` — юнит-тесты (node:test).
- `node build.js` — сборка `antar-sheet.html` из `src/` (app.js, calc.js, store.js, data-core.js, data-physical.js, data-magic.js, style.css).

Собранный файл самодостаточен: всю игру ведёт встроенный скрипт, внешних зависимостей нет.