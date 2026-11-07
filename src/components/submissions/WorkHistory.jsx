import React from 'react';
export function WorkHistory({ history }) {
  return (
    <>
      <h3>История авторов</h3>
      {!history.authors.length && <p>Автор ещё не назначался.</p>}
      <ol>
        {history.authors.map((event) => (
          <li key={event.id}>
            <strong>{event.name}</strong> {event.number && `(${event.number})`} · сдача №{' '}
            {event.version}
            {event.current ? ' · Текущее назначение' : ' · Прежнее назначение'}
            <p>
              {new Date(event.createdAt).toLocaleString('ru-RU')} · преподаватель: {event.changedBy}
            </p>
          </li>
        ))}
      </ol>
      <p className="hint">
        Номера прежних и удалённых сдач сохраняются в истории и не используются повторно.
      </p>
      <h3>История копий для ИИ</h3>
      {!history.copies.length && <p>Копия ещё не создавалась.</p>}
      <ul>
        {history.copies.map((copy) => (
          <li key={copy.id}>
            Редакция {copy.revision} · {copy.name} ·{' '}
            {new Date(copy.createdAt).toLocaleString('ru-RU')}
            {copy.invalidReason && (
              <strong className="history-invalid">Недействительна: {copy.invalidReason}</strong>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
