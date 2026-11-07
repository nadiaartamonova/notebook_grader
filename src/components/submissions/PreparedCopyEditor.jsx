import React from 'react';
import { command } from '../../api.js';
export function PreparedCopyEditor({
  copy,
  busy,
  body,
  setBody,
  setReviewed,
  reviewed,
  action,
  context,
  view,
  setCopy,
  onRefresh,
  setView,
}) {
  const findings = JSON.parse(copy.findings);
  return (
    <>
      {findings.names === 0 && (
        <p className="text-limit-warning" role="alert">
          Имя студента в работе не найдено. Проверьте, что автор назначен верно и имя в тексте
          обезличено
        </p>
      )}
      <p className="inline-note">
        Ничего не отправлено. Проверьте текст: автоматическая замена может пропустить личные данные
        или затронуть код.
      </p>
      <p className="hint">
        В копию входят условие и критерии, зафиксированные при загрузке работы. Метаданные, выводы
        ячеек и вложения не включаются.
      </p>
      <details>
        <summary>Результат автоматической подготовки</summary>
        <ul>
          {Object.entries(findings)
            .filter(([key]) => key !== 'nameNotFound')
            .map(([k, v]) => (
              <li key={k}>
                {
                  {
                    names: 'Замены имени',
                    numbers: 'Замены учебного номера',
                    emails: 'Замены почты',
                    phones: 'Возможные телефоны',
                    images: 'Изображения',
                    excludedRawCells: 'Исключённые необработанные ячейки',
                    excludedOutputCells: 'Ячейки с исключёнными выводами',
                    excludedAttachmentCells: 'Ячейки с исключёнными вложениями',
                  }[k]
                }
                : {v}
              </li>
            ))}
        </ul>
      </details>
      <label>
        Текст копии (JSON)
        <textarea
          className="payload-editor"
          spellCheck={false}
          disabled={busy}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setReviewed(false);
          }}
        />
      </label>
      <label className="checkline">
        <input
          type="checkbox"
          disabled={busy}
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        Я просмотрела/просмотрел содержимое копии
      </label>
      <p className="hint">
        Редакция копии: {copy.revision}. Исходный файл остаётся без изменений. Отправку в ИИ
        подключим отдельно.
      </p>
      <button
        className="primary"
        disabled={busy}
        onClick={() =>
          action(async () => {
            const next = await command('savePreparedCopy', {
              ...context,
              importId: view.work.importId,
              expectedId: copy.id,
              body,
              reviewed,
            });
            setCopy(next);
            await onRefresh();
            setView(null);
          })
        }
      >
        Сохранить копию
      </button>
    </>
  );
}
