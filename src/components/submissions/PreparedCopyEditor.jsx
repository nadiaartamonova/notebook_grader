import React, { useRef, useState } from 'react';
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
  const editor = useRef(null);
  const [navigationError, setNavigationError] = useState('');
  function goToCell(number) {
    const match = new RegExp('"number"\\s*:\\s*' + number + '(?=\\s*[,}])').exec(body);
    if (!match) {
      setNavigationError('Ячейка не найдена в изменённом JSON. Проверьте текст вручную.');
      return;
    }
    setNavigationError('');
    const element = editor.current;
    element.focus();
    element.setSelectionRange(match.index, match.index + match[0].length);
    element.scrollTop =
      body.slice(0, match.index).split('\n').length *
        (parseFloat(getComputedStyle(element).lineHeight) || 20) -
      80;
    element.scrollIntoView({ block: 'center' });
  }
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
            .filter(([key, value]) => typeof value === 'number' && key !== 'redactionVersion')
            .map(([k, v]) => (
              <li key={k}>
                {
                  {
                    names: 'Замены имени',
                    typos: 'Из них: опечатки',
                    labels: 'Из них: подписи автора',
                    paths: 'Имена пользователей в путях',
                    handles: 'Ники в ссылках',
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
      {findings.suspicious?.length > 0 && (
        <section className="manual-redaction">
          <h3>Проверьте вручную</h3>
          <p className="hint">
            Подозрительные фрагменты не заменены. Список относится к автоматически подготовленной
            редакции.
          </p>
          <ul>
            {findings.suspicious.map((item, index) => (
              <li key={index}>
                {item.text} — {item.reason}.{' '}
                <button
                  type="button"
                  className="quiet"
                  disabled={busy}
                  onClick={() => goToCell(item.cell)}
                >
                  К ячейке {item.cell}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {navigationError && <p role="alert">{navigationError}</p>}
      <label>
        Текст копии (JSON)
        <textarea
          ref={editor}
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
        className="secondary"
        disabled={busy}
        onClick={() =>
          action(async () => {
            const next = await command('prepareSubmission', {
              ...context,
              importId: view.work.importId,
              regenerate: true,
            });
            setCopy(next);
            setBody(next.body);
            setReviewed(false);
            setNavigationError('');
            await onRefresh();
          })
        }
      >
        Подготовить заново
      </button>
      <p className="hint">
        Повторная подготовка создаёт новую редакцию из оригинала. Сохранённые редакции остаются в
        истории; несохранённые правки текущего текста будут заменены.
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
