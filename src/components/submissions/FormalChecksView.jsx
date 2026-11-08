import React, { useState } from 'react';
import { command } from '../../api.js';
import { Icon } from '../ui/Icon.jsx';
const names = {
  filename: 'Имя файла',
  firstCell: 'Первая ячейка',
  identity: 'Имя и дата',
  tasks: 'Заголовки задач',
  aiForm: 'Форма ИИ',
  syntax: 'Синтаксис',
};
const icons = { passed: 'check', failed: 'x', skipped: 'minus' };
export function FormalChecksView({ initial, context, work, busy, action }) {
  const [data, setData] = useState(initial),
    [selected, setSelected] = useState(0),
    [cell, setCell] = useState(null);
  const p = { ...context, importId: work.importId };
  const run = data.runs[selected];
  const failed = run ? run.results.filter((r) => r.status === 'failed').length : 0;
  return (
    <>
      <div className="dialog-toolbar">
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
          <Icon name="play" />
          {data.runs.length ? 'Запустить снова' : 'Запустить проверки'}
        </button>
        {data.runs.length > 1 && (
          <select
            aria-label="Запуск"
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
        )}
      </div>
      {!run && <p className="muted">Проверки ещё не запускались. Код не исполняется.</p>}
      {run && (
        <>
          <p className={`check-summary ${failed ? 'bad' : 'good'}`}>
            {failed ? `Не пройдено: ${failed}` : 'Все проверки пройдены'}
            <span className="muted"> · {new Date(run.createdAt).toLocaleString('ru-RU')}</span>
          </p>
          <ul className="formal-results">
            {run.results.map((r, i) => (
              <li key={i} className={`result-${r.status}`}>
                <span className="result-icon">
                  <Icon name={icons[r.status]} />
                </span>
                <span className="result-text">
                  <strong>{names[r.check] ?? r.check}</strong>
                  {r.message}
                </span>
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
                    Ячейка {r.cell}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {cell && (
        <section
          aria-live="polite"
          ref={(element) => element?.scrollIntoView({ block: 'nearest' })}
        >
          <h3>Ячейка {cell.number}</h3>
          <pre className="source-text">{cell.source}</pre>
        </section>
      )}
    </>
  );
}
