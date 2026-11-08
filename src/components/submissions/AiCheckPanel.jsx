import React, { useEffect, useState } from 'react';
import { command } from '../../api.js';
import { AiSettings } from '../forms/AiSettings.jsx';
import { Icon } from '../ui/Icon.jsx';
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
export function AiCheckPanel({ context, work, onRefresh, onReview }) {
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
      await onRefresh?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  }
  const latest = runs[0];
  const fmt = (n) => String(n).replace('.', ',');
  const duration = (run) =>
    run.started_at && run.finished_at
      ? ((new Date(run.finished_at) - new Date(run.started_at)) / 1000).toFixed(0) + ' с'
      : '—';
  return (
    <section className="ai-panel">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {settings && provider === 'openai' && (!settings.hasKey || !settings.available) ? (
        <>
          {settings.mockAvailable && (
            <button className="quiet" onClick={() => setProvider('mock')}>
              Использовать тестовый поставщик
            </button>
          )}
          <AiSettings profileId={context.profileId} onSaved={setSettings} />
        </>
      ) : (
        !preview &&
        !running && (
          <div className="dialog-toolbar">
            <button
              className="primary"
              disabled={busy || !settings}
              onClick={() =>
                act(async () => setPreview(await command('previewAiCheck', { ...p, provider })))
              }
            >
              <Icon name="spark" />
              {runs.length ? 'Проверить ещё раз' : 'Подготовить отправку'}
            </button>
            {settings?.mockAvailable && (
              <select
                aria-label="Поставщик"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="mock">Тестовый (без сети)</option>
              </select>
            )}
          </div>
        )
      )}
      {preview && !running && (
        <div className="confirm-card">
          <h3>Подтверждение отправки</h3>
          <dl>
            <dt>Модель</dt>
            <dd>
              {preview.provider === 'openai' ? 'OpenAI' : 'Тестовый'} · {preview.model}
            </dd>
            <dt>Объём</dt>
            <dd>≈ {preview.inputTokens.toLocaleString('ru-RU')} токенов</dd>
            <dt>Стоимость</dt>
            <dd>
              {preview.inputCost === null
                ? 'неизвестна'
                : `≈ $${preview.inputCost.toFixed(3)} за вход + ответ (расчётно)`}
            </dd>
            <dt>За месяц</dt>
            <dd>
              ${preview.spent.toFixed(2)} из ${Number(preview.monthlyLimit).toFixed(2)}
            </dd>
          </dl>
          <details>
            <summary>Показать, что отправляется</summary>
            <pre className="source-text">{JSON.stringify(preview.request, null, 2)}</pre>
          </details>
          <p className="hint">
            Уходит только обезличенная копия — без оригинала и карточки студента. OpenAI не хранит
            ответ (store: false).
          </p>
          <div className="form-actions">
            <button className="secondary" disabled={busy} onClick={() => setPreview(null)}>
              Отмена
            </button>
            <button className="primary" disabled={busy} onClick={send}>
              Подтвердить и отправить
            </button>
          </div>
        </div>
      )}
      {running && (
        <div className="running-card" role="status">
          <span className="spinner" aria-hidden="true" />
          Проверка выполняется… обычно до минуты
          <button
            className="secondary"
            onClick={() => act(() => command('cancelAiCheck', { ...p, requestId: running }))}
          >
            Отменить
          </button>
        </div>
      )}
      {latest?.status === 'completed' && onReview && !running && (
        <div className="ai-banner">
          <Icon name="star" />
          <span>
            Итог ИИ: <b>{fmt(latest.scores.reduce((sum, s) => sum + s.points, 0))}</b> из{' '}
            {fmt(latest.scores.reduce((sum, s) => sum + s.maximum, 0))}
          </span>
          <button className="primary" onClick={onReview}>
            Перейти к оценке
          </button>
        </div>
      )}
      {runs.length > 0 && <h3 className="section-space">История проверок</h3>}
      {runs.map((run, index) => (
        <details key={run.id} className="run-card" open={index === 0}>
          <summary>
            <span className={`badge badge-run-${run.status}`}>{statuses[run.status]}</span>
            <span>
              {run.model} · {run.prompt_version} ·{' '}
              {new Date(run.started_at ?? run.finished_at).toLocaleString('ru-RU')}
            </span>
            <span className="muted run-meta">
              {duration(run)}
              {run.estimated_cost !== null && ` · $${run.estimated_cost.toFixed(3)}`}
            </span>
          </summary>
          {['queued', 'running'].includes(run.status) && (
            <button
              className="secondary"
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
          {run.scores.length > 0 && (
            <table className="run-scores">
              <tbody>
                {run.scores.map((s, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>{s.justification}</small>
                    </td>
                    <td className="num">
                      <b>{fmt(s.points)}</b> / {fmt(s.maximum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {run.findings.length > 0 && (
            <ul className="finding-list">
              {run.findings.map((f, i) => (
                <li key={i} className={`finding-${f.type}`}>
                  <b>{types[f.type]}</b> {f.text} <small>{f.recommendation}</small>
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
                      Ячейка {f.cell}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {run.feedback && <p className="run-feedback">{run.feedback}</p>}
          <p className="muted run-tokens">
            Токены: вход {run.input_tokens ?? '—'}, выход {run.output_tokens ?? '—'}
          </p>
        </details>
      ))}
      {cell && (
        <section aria-live="polite" ref={(el) => el?.scrollIntoView({ block: 'nearest' })}>
          <h3>Ячейка {cell.number}</h3>
          <pre className="source-text">{cell.source}</pre>
        </section>
      )}
    </section>
  );
}
