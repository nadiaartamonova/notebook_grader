import React, { useState } from 'react';
import { command } from '../../api.js';
import { TextControl } from '../ui/TextControl.jsx';

// Предложения ИИ и решение преподавателя — разные значения. Пока источник ИИ не подключён.
export function ReviewEditor({ initial, context, work, onRefresh, action, busy }) {
  const [review, setReview] = useState(initial);
  const [scores, setScores] = useState(() =>
    initial.criteria.map((c) => ({
      criterionId: c.id,
      points: initial.current?.scores.find((s) => s.criterionId === c.id)?.points ?? '',
      comment: initial.current?.scores.find((s) => s.criterionId === c.id)?.comment ?? '',
    })),
  );
  const [feedback, setFeedback] = useState(initial.current?.feedback ?? '');
  const [editing, setEditing] = useState(initial.current?.status !== 'approved');
  const [copied, setCopied] = useState('');
  const sum = scores.reduce((total, s) => total + Number(s.points || 0), 0);
  const maximum = review.criteria.reduce((total, c) => total + c.max, 0);
  async function save(status) {
    await action(async () => {
      const result = await command('saveReview', {
        ...context,
        importId: work.importId,
        expectedAuthorEventId: review.authorEventId,
        expectedReviewId: review.current?.id ?? null,
        status,
        scores,
        feedback,
      });
      setReview(result);
      setEditing(status !== 'approved');
      setCopied('');
      await onRefresh();
    });
  }
  async function copyFeedback() {
    await action(async () => {
      const text = [
        `Отзыв: ${work.studentName}`,
        ...review.criteria.map(
          (c, i) =>
            `${c.name}: ${scores[i].points === '' ? 'не выставлено' : scores[i].points} / ${c.max}${scores[i].comment ? ' — ' + scores[i].comment : ''}`,
        ),
        `Итого: ${sum} / ${maximum}`,
        feedback,
      ].join('\n');
      const copied = await command('copyReviewText', { ...context, importId: work.importId, text });
      if (!copied.copied) await navigator.clipboard.writeText(copied.text);
      setCopied('Отзыв скопирован');
    });
  }
  return (
    <>
      <p>
        {work.studentName} · {work.file}
      </p>
      <p className="hint">Критерии зафиксированы при загрузке работы. ИИ пока не подключён.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Критерий</th>
              <th>Оценка ИИ</th>
              <th>Оценка преподавателя</th>
            </tr>
          </thead>
          <tbody>
            {review.criteria.map((c, i) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.description}</small>
                  <small>Максимум: {c.max}</small>
                </td>
                <td>—</td>
                <td>
                  <input
                    aria-label={`Балл: ${c.name}`}
                    type="number"
                    min="0"
                    max={c.max}
                    step="0.5"
                    value={scores[i].points}
                    disabled={busy || !editing}
                    onChange={(e) =>
                      setScores(
                        scores.map((s, j) => (j === i ? { ...s, points: e.target.value } : s)),
                      )
                    }
                  />
                  <label>
                    Комментарий
                    <TextControl
                      as="textarea"
                      maxLength={10000}
                      value={scores[i].comment}
                      disabled={busy || !editing}
                      onChange={(e) =>
                        setScores(
                          scores.map((s, j) => (j === i ? { ...s, comment: e.target.value } : s)),
                        )
                      }
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="total">
        Сумма: {sum} / {maximum}
      </p>
      <label>
        Общий отзыв студенту
        <TextControl
          as="textarea"
          maxLength={50000}
          value={feedback}
          disabled={busy || !editing}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </label>
      <div className="work-actions">
        {editing ? (
          <>
            <button className="secondary" disabled={busy} onClick={() => save('draft')}>
              Сохранить черновик
            </button>
            <button className="primary" disabled={busy} onClick={() => save('approved')}>
              Утвердить оценку
            </button>
          </>
        ) : (
          <button className="secondary" onClick={() => setEditing(true)}>
            Создать исправление
          </button>
        )}
        <button className="secondary" disabled={busy} onClick={copyFeedback}>
          Скопировать отзыв
        </button>
      </div>
      <p role="status">
        {copied ||
          (review.current?.status === 'approved'
            ? 'Оценка утверждена'
            : review.current
              ? 'Черновик сохранён'
              : 'Оценка ещё не сохранена')}
      </p>
      {review.history.length > 0 && (
        <details>
          <summary>История решений преподавателя</summary>
          <ul>
            {review.history.map((r) => (
              <li key={r.id}>
                Версия {r.revision} · {r.status === 'approved' ? 'Утверждено' : 'Черновик'} ·{' '}
                {new Date(r.createdAt).toLocaleString('ru-RU')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
