# Задание 5: изменённые файлы

08.11.2026. Только Apps3; коммит не создан. Старые миграции 001–006 не изменены.

## Проверки и хранение

- `backend/checks/index.js`
- `backend/checks/settings.js`
- `backend/database/migrations/007-formal-checks.js`
- `backend/database/connection.js`
- `backend/repositories/formal-checks-repository.js`
- `backend/services/formal-checks-service.js`
- `backend/services/assignment-service.js`
- `backend/services/workspace-service.js`
- `backend/dto/assignment-input.js`
- `desktop/preload.cjs`

## Интерфейс

- `src/components/forms/FormalChecksFields.jsx`
- `src/components/forms/AssignmentEditor.jsx`
- `src/components/forms/WorkspaceDialogs.jsx`
- `src/components/submissions/FormalChecksView.jsx`
- `src/components/submissions/AssignmentWorks.jsx`

## Тесты

- `tests/formal-checks.test.js`
- `tests/migration-003.test.js`
- `tests/external-identities.test.js`
- `tests/electron-formal-checks.cjs`
- `scripts/check-electron.cjs`

## Документация

- `README.md`
- `docs/DATA_MODEL.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/AI_PLAN.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/BACKLOG.md`
- `docs/TASK5_CHANGES.md`

## Решения и проверка

Миграция 007 добавляет настройки версий и историю запусков в отдельные таблицы с неизменяемостью. Существующие данные сохраняются; история связана с событием автора. Python и внешние сервисы не используются. Следующий шаг ИИ отложен до проверки пользователя.

Команды: `npm test` (50 тестов), `npm run format:check`, `npm run build`, `npm run test:electron`. Electron запускается вне ограниченной среды: внутри неё графический процесс Windows завершался до загрузки интерфейса.
