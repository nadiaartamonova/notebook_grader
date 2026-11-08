import React, { useState } from 'react';
import { command } from '../../api.js';
export function FormalChecksView({ initial, context, work, busy, action }) {
  const [data, setData] = useState(initial),
    [selected, setSelected] = useState(0),
    [cell, setCell] = useState(null);
  const p = { ...context, importId: work.importId };
  const run = data.runs[selected];
  return (
    <>
      <p className="hint">
        Проверяется оригинал по версии задания на момент сдачи. Код не исполняется. Результаты не
        выставляют оценку.
      </p>
      <button
        className="primary"
        disabled={busy}
        onClick={() =>
          action(async () => {
            setData(await command('runFormalChecks', p));
            setSelected(0);
            setCell(null);
          })
        }
      >
        Запустить проверки
      </button>
      {data.runs.length ? (
        <label>
          История запусков
          <select
            value={selected}
            onChange={(e) => {
              setSelected(Number(e.target.value));
              setCell(null);
            }}
          >
            {data.runs.map((r, i) => (
              <option value={i} key={r.id}>
                Запуск {data.runs.length - i} · {new Date(r.createdAt).toLocaleString('ru-RU')}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>Проверки ещё не запускались.</p>
      )}
      {run && (
        <ul className="formal-results">
          {run.results.map((r, i) => (
            <li key={i}>
              <strong>
                {
                  { passed: '✓ Пройдено', failed: '✗ Не пройдено', skipped: '— Пропущено' }[
                    r.status
                  ]
                }
              </strong>
              : {r.message}{' '}
              {r.cell && (
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      const original = await command('readSubmission', p);
                      setCell(original.cells.find((c) => c.number === r.cell));
                    })
                  }
                >
                  К ячейке {r.cell}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {cell && (
        <section
          aria-live="polite"
          ref={(element) => element?.scrollIntoView({ block: 'nearest' })}
        >
          <h3>Исходный текст · Ячейка {cell.number}</h3>
          <pre className="source-text">{cell.source}</pre>
        </section>
      )}
    </>
  );
}
