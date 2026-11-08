import React, { useEffect, useState } from 'react';
import { command } from '../../api.js';
import { Icon } from '../ui/Icon.jsx';
// onDone(message) — закрыть окно после сохранения. onSaved(state) — для встраивания в окно проверки.
export function AiSettings({ profileId, onSaved, onDone }) {
  const [data, setData] = useState(null),
    [key, setKey] = useState(''),
    [model, setModel] = useState(''),
    [limit, setLimit] = useState(5),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(null);
  const p = { profileId };
  function accept(next) {
    setData(next);
    setModel(next.model);
    setLimit(next.monthlyLimit);
    onSaved?.(next);
  }
  useEffect(() => {
    command('getAiSettings', p)
      .then(accept)
      .catch((e) => setMessage({ error: true, text: e.message }));
  }, [profileId]);
  async function perform(fn) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ error: true, text: e.message });
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return message ? <p className="error">{message.text}</p> : <p className="muted">Загрузка…</p>;
  const custom = !data.models.includes(model);
  return (
    <div className="ai-settings">
      {!data.available && (
        <p className="inline-note">
          Настоящий OpenAI работает только в приложении. В браузере — тестовый поставщик.
        </p>
      )}
      <section className="settings-block">
        <h3>Ключ OpenAI</h3>
        <p className={`key-state ${data.hasKey ? 'ok' : ''}`}>
          <Icon name={data.hasKey ? 'check' : 'minus'} />
          {data.hasKey ? `Ключ сохранён · …${data.last4}` : 'Ключ не сохранён'}
        </p>
        {data.storageError && <p className="error">{data.storageError}</p>}
        <div className="inline-form">
          <input
            type="password"
            autoComplete="off"
            aria-label="Ключ OpenAI"
            placeholder={data.hasKey ? 'Вставьте новый ключ, чтобы заменить' : 'sk-…'}
            value={key}
            disabled={busy || !data.available}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            className="primary"
            disabled={busy || !data.available || !key}
            onClick={() =>
              perform(async () => {
                try {
                  accept(await command('saveAiKey', { ...p, key }));
                  setMessage({ text: 'Ключ сохранён.' });
                } finally {
                  setKey('');
                }
              })
            }
          >
            Сохранить
          </button>
        </div>
        <div className="row-actions">
          <button
            className="secondary"
            disabled={busy || !data.hasKey || !data.available}
            onClick={() =>
              perform(async () =>
                setMessage({ text: (await command('checkAiConnection', p)).message }),
              )
            }
          >
            Проверить подключение
          </button>
          {data.hasKey && (
            <button
              className="quiet danger-text"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  accept(await command('deleteAiKey', p));
                  setKey('');
                  setMessage({ text: 'Ключ удалён.' });
                })
              }
            >
              Удалить ключ
            </button>
          )}
        </div>
        {message && (
          <p className={message.error ? 'error' : 'success-text'} role="status">
            {message.text}
          </p>
        )}
      </section>
      <section className="settings-block">
        <h3>Модель и расходы</h3>
        <div className="form-row">
          <label>
            Модель
            <select
              value={custom ? 'other' : model}
              onChange={(e) => setModel(e.target.value === 'other' ? '' : e.target.value)}
              disabled={busy}
            >
              {data.models.map((m) => (
                <option key={m}>{m}</option>
              ))}
              <option value="other">Другая…</option>
            </select>
          </label>
          <label>
            Лимит в месяц, USD
            <input
              type="number"
              min="0"
              max="100000"
              step="0.5"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
        </div>
        {custom && (
          <label>
            Название модели
            <input value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} />
          </label>
        )}
        <p className="hint">
          Потрачено в этом месяце: ${data.spent.toFixed(2)} из $
          {Number(data.monthlyLimit).toFixed(2)} (расчётно, цены на {data.priceDate}).
        </p>
      </section>
      <div className="form-actions">
        {onDone && (
          <button className="secondary" disabled={busy} onClick={() => onDone()}>
            Закрыть
          </button>
        )}
        <button
          className="primary"
          disabled={busy || !model}
          onClick={() =>
            perform(async () => {
              accept(await command('saveAiSettings', { ...p, model, monthlyLimit: Number(limit) }));
              if (onDone) onDone('Настройки ИИ сохранены');
              else setMessage({ text: 'Настройки сохранены.' });
            })
          }
        >
          Сохранить настройки
        </button>
      </div>
    </div>
  );
}
