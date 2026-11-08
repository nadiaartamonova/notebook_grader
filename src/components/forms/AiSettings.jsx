import React, { useEffect, useState } from 'react';
import { command } from '../../api.js';
export function AiSettings({ profileId, onSaved }) {
  const [data, setData] = useState(null),
    [key, setKey] = useState(''),
    [model, setModel] = useState(''),
    [limit, setLimit] = useState(5),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
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
      .catch((e) => setMessage(e.message));
  }, [profileId]);
  async function perform(fn) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Подключение ИИ</h2>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          {!data.available && (
            <p className="inline-note">
              Настоящий OpenAI доступен только в приложении Electron. В браузере доступен тестовый
              поставщик.
            </p>
          )}
          <p>{data.hasKey ? `Ключ задан · …${data.last4}` : 'Ключ не задан'}</p>
          {data.storageError && <p role="alert">{data.storageError}</p>}
          <label>
            Ключ OpenAI
            <input
              type="password"
              autoComplete="off"
              value={key}
              disabled={busy || !data.available}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !data.available || !key}
            onClick={() =>
              perform(async () => {
                try {
                  accept(await command('saveAiKey', { ...p, key }));
                  setMessage('Ключ сохранён в зашифрованном файле.');
                } finally {
                  setKey('');
                }
              })
            }
          >
            Сохранить ключ
          </button>
          <button
            className="secondary"
            disabled={busy || !data.hasKey || !data.available}
            onClick={() =>
              perform(async () => setMessage((await command('checkAiConnection', p)).message))
            }
          >
            Проверить подключение
          </button>
          <button
            className="quiet"
            disabled={busy || !data.hasKey}
            onClick={() =>
              perform(async () => {
                accept(await command('deleteAiKey', p));
                setKey('');
              })
            }
          >
            Удалить ключ
          </button>
          <p className="hint">
            Ключ общий для приложения на этом компьютере. Не вставляйте его в работу или текст
            задания.
          </p>
          <label>
            Модель
            <select
              value={data.models.includes(model) ? model : 'other'}
              onChange={(e) => setModel(e.target.value === 'other' ? '' : e.target.value)}
              disabled={busy}
            >
              {data.models.map((m) => (
                <option key={m}>{m}</option>
              ))}
              <option value="other">Другая модель</option>
            </select>
          </label>
          {!data.models.includes(model) && (
            <label>
              Другая модель
              <input value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} />
            </label>
          )}
          <label>
            Месячный лимит, USD
            <input
              type="number"
              min="0"
              max="100000"
              step="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <p className="hint">
            За месяц: {data.spent.toFixed(6)} USD, расчётно. Таблица цен на {data.priceDate}. Для
            неизвестной модели стоимость не рассчитывается. Лимит приложения не заменяет лимиты
            аккаунта OpenAI и не учитывает неизвестные цены или списания за неуспешные запросы.
          </p>
          <button
            className="primary"
            disabled={busy || !model}
            onClick={() =>
              perform(async () => {
                accept(
                  await command('saveAiSettings', { ...p, model, monthlyLimit: Number(limit) }),
                );
                setMessage('Настройки сохранены.');
              })
            }
          >
            Сохранить настройки
          </button>
        </>
      )}
    </section>
  );
}
