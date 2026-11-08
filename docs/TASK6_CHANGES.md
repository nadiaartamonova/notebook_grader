# Задание 6: инфраструктура ИИ без сети

08.11.2026. Коммит не создавался. Изменения только в Apps3. Миграции 001–007, CSP и пользовательский интерфейс не менялись.

## Рабочая часть

- `backend/ai/prompts/review-v1.js`
- `backend/ai/providers/mock.js`
- `backend/ai/provider-call.js`
- `backend/ai/response.js`
- `backend/dto/ai-check-input.js`
- `backend/dto/assignment-input.js`
- `backend/services/ai-service.js`
- `backend/services/assignment-service.js`
- `backend/services/submission-service.js`
- `backend/services/workspace-service.js`
- `backend/repositories/ai-repository.js`
- `backend/domain/notebooks.js`
- `backend/store.js`

## База и Electron

- `backend/database/migrations/008-ai-checks.js`
- `backend/database/connection.js`
- `desktop/preload.cjs`
- `desktop/main.cjs`

## Проверки

- `tests/ai-checks.test.js`
- `tests/electron-ai.cjs`
- `tests/migration-003.test.js`
- `tests/external-identities.test.js`
- `scripts/check-electron.cjs`

## Документация

- `README.md`
- `docs/AI_PLAN.md`
- `docs/BACKLOG.md`
- `docs/DATA_MODEL.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/TASK6_CHANGES.md`

## Решения

Миграция 008 содержит собственные значения по умолчанию. Новые таблицы: assignment_languages, copy_criteria, check_runs, check_scores, check_findings. Снимок запроса фиксирует конкретную просмотренную редакцию, язык версии задания и последние формальные результаты. Старые копии не переписываются. Состояния запуска меняются короткими транзакциями; результаты сохраняются целиком либо не сохраняются. Все конечные состояния и результаты защищены триггерами.

runAiCheck разрешён только при aiDevelopment=true (Electron: !app.isPackaged). Поставщик только mock; в IPC нельзя выбрать произвольный URL, код или реальный сервис. Отмена через AbortSignal предусмотрена в рабочей части; новых кнопок нет. Сценарии перечислены в IMPLEMENTATION_STATUS.md. Инструкция review-v1 требует не упоминать имена людей. Это не детектор всех персональных данных.

## Проверено

- npm test: 67 тестов, включая миграцию 7 → 8.
- npm run format:check.
- npm run build.
- npm run test:electron: mock через изолированный preload и отклонение неверного JSON. Запуск вне ограниченной среды из-за прежней ошибки GPU внутри неё.

Остались отдельные будущие этапы: реальный поставщик/API, управление ключом, интерфейс результатов и отмены.
