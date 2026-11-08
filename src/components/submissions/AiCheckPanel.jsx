import React, { useEffect, useState } from 'react';
import { command } from '../../api.js';
import { AiSettings } from '../forms/AiSettings.jsx';
const statuses = {
  queued: 'В очереди',
  running: 'Выполняется',
  completed: 'Завершена',
  failed: 'Ошибка',
  interrupted: 'Прервана',
};
const types = {
  violation: 'Нарушение',
  recommendation: 'Рекомендация',
  assumption: 'Предположение',
};
export function AiCheckPanel({ context, work }) {
  const p = { ...context, importId: work.importId };
  const [settings, setSettings] = useState(null),
    [runs, setRuns] = useState([]),
    [preview, setPreview] = useState(null),
    [running, setRunning] = useState(null),
    [error, setError] = useState(''),
    [cell, setCell] = useState(null),
    [provider, setProvider] = useState('openai'),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const state = await command('getAiSettings', p);
    setSettings(state);
    if (!state.available && state.mockAvailable) setProvider('mock');
    setRuns((await command('getAiHistory', p)).runs);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [work.importId]);
  async function act(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    const requestId = crypto.randomUUID();
    setRunning(requestId);
    setError('');
    try {
      await command('runAiCheck', { ...p, provider, confirmationToken: preview.token, requestId });
      setPreview(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  }
  return (
    <section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {settings?.mockAvailable && (
        <label>
          Поставщик
          <select
            disabled={Boolean(running) || busy}
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPreview(null);
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="mock">Тестовый поставщик (без сети)</option>
          </select>
        </label>
      )}
      {settings && provider === 'openai' && (!settings.hasKey || !settings.available) ? (
        <AiSettings profileId={context.profileId} onSaved={setSettings} />
      ) : (
        <>
          <button
            className="secondary"
            disabled={Boolean(running) || busy || !settings}
            onClick={() =>
              act(async () => setPreview(await command('previewAiCheck', { ...p, provider })))
            }
          >
            Подготовить отправку
          </button>
          {preview && (
            <section>
              <h3>Подтверждение отправки</h3>
              <p>
                Поставщик: {preview.provider === 'openai' ? 'OpenAI' : 'Тестовый'} · Модель:{' '}
                {preview.model}
              </p>
              <p>
                Вход: около {preview.inputTokens} токенов. Стоимость входа:{' '}
                {preview.inputCost === null ? 'неизвестна' : preview.inputCost.toFixed(6) + ' USD'},
                расчётно. Ответ оплачивается дополнительно; итог зависит от его длины.
              </p>
              <p>
                За месяц: {preview.spent.toFixed(6)} / {preview.monthlyLimit} USD, расчётно.
              </p>
              <details>
                <summary>Показать, что отправляется</summary>
                <pre className="source-text">{JSON.stringify(preview.request, null, 2)}</pre>
              </details>
              <p className="hint">
                Проверьте отсутствие личных данных. OpenAI получит этот текст после подтверждения;
                оригинал и карточка студента не добавляются. Ответ запрашивается с store: false.
              </p>
              <button className="primary" disabled={Boolean(running) || busy} onClick={send}>
                Подтвердить и отправить
              </button>
            </section>
          )}
        </>
      )}
      {running && (
        <p role="status">
          Выполняется…{' '}
          <button
            className="secondary"
            onClick={() => act(() => command('cancelAiCheck', { ...p, requestId: running }))}
          >
            Отменить
          </button>
        </p>
      )}
      <h3>История запусков</h3>
      {!runs.length && <p>Запусков пока нет.</p>}
      {runs.map((run) => (
        <details key={run.id} open={runs[0].id === run.id}>
          <summary>
            {statuses[run.status]} · {run.model} ·{' '}
            {new Date(run.started_at ?? run.finished_at).toLocaleString('ru-RU')}
          </summary>
          {['queued', 'running'].includes(run.status) && (
            <button
              onClick={() =>
                act(async () => {
                  await command('cancelAiCheck', { ...p, requestId: run.id });
                  await refresh();
                })
              }
            >
              Отменить запуск
            </button>
          )}
          {run.error && <p className="error">{run.error}</p>}
          <p>
            Токены: вход {run.input_tokens ?? '—'}, выход {run.output_tokens ?? '—'}. Стоимость:{' '}
            {run.estimated_cost === null ? 'неизвестна' : run.estimated_cost.toFixed(6) + ' USD'},
            расчётно. Время:{' '}
            {run.started_at && run.finished_at
              ? ((new Date(run.finished_at) - new Date(run.started_at)) / 1000).toFixed(1) + ' с'
              : '—'}
            .
          </p>
          {run.scores.length > 0 && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Критерий</th>
                    <th>Баллы</th>
                    <th>Обоснование</th>
                  </tr>
                </thead>
                <tbody>
                  {run.scores.map((s, i) => (
                    <tr key={i}>
                      <td>{s.name}</td>
                      <td>
                        {s.points} / {s.maximum}
                      </td>
                      <td>{s.justification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Сумма: {run.scores.reduce((sum, s) => sum + s.points, 0)}</p>
            </>
          )}
          <ul>
            {run.findings.map((f, i) => (
              <li key={i}>
                <strong>{types[f.type]}</strong>: {f.text} {f.recommendation}{' '}
                {f.cell && (
                  <button
                    className="quiet"
                    onClick={() =>
                      act(async () => {
                        const original = await command('readSubmission', p);
                        setCell(original.cells.find((c) => c.number === f.cell));
                      })
                    }
                  >
                    К ячейке {f.cell}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p style={{ whiteSpace: 'pre-wrap' }}>{run.feedback}</p>
        </details>
      ))}
      {cell && (
        <section aria-live="polite">
          <h3>Исходный текст · Ячейка {cell.number}</h3>
          <pre className="source-text">{cell.source}</pre>
        </section>
      )}
    </section>
  );
}
