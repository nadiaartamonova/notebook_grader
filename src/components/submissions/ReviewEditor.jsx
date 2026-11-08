import React, { useState } from 'react';
import { command } from '../../api.js';
import { TextControl } from '../ui/TextControl.jsx';
import { Icon } from '../ui/Icon.jsx';

const fmt = (n) => (n === null || n === undefined || n === '' ? '—' : String(n).replace('.', ','));
const types = {
  violation: 'Нарушение',
  recommendation: 'Рекомендация',
  assumption: 'Предположение',
};

// Предложение ИИ и решение преподавателя хранятся отдельно. ИИ только подсказывает:
// баллы и отзыв попадают в оценку, когда преподаватель сам нажмёт «Принять».
export function ReviewEditor({ initial, context, work, onRefresh, action, busy }) {
  const [review, setReview] = useState(initial);
  const ai = review.aiProposal;
  const aiFor = (id) => ai?.scores.find((s) => s.criterionId === id) ?? null;
  const [scores, setScores] = useState(() =>
    initial.criteria.map((c) => ({
      criterionId: c.id,
      points: initial.current?.scores.find((s) => s.criterionId === c.id)?.points ?? '',
      comment: initial.current?.scores.find((s) => s.criterionId === c.id)?.comment ?? '',
    })),
  );
  const [openComments, setOpenComments] = useState(() =>
    Object.fromEntries(
      initial.current?.scores.filter((s) => s.comment).map((s) => [s.criterionId, true]) ?? [],
    ),
  );
  const [feedback, setFeedback] = useState(initial.current?.feedback ?? '');
  const [editing, setEditing] = useState(initial.current?.status !== 'approved');
  const [copied, setCopied] = useState('');
  const sum = scores.reduce((total, s) => total + Number(s.points || 0), 0);
  const maximum = review.criteria.reduce((total, c) => total + c.max, 0);
  const filled = scores.filter((s) => s.points !== '').length;

  function update(i, patch) {
    setScores((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  function accept(i) {
    const proposal = aiFor(review.criteria[i].id);
    if (!proposal) return;
    update(i, {
      points: String(proposal.points),
      comment: scores[i].comment || proposal.justification,
    });
    if (!scores[i].comment && proposal.justification)
      setOpenComments((o) => ({ ...o, [review.criteria[i].id]: true }));
  }
  function acceptAll() {
    review.criteria.forEach((_, i) => accept(i));
    if (!feedback.trim() && ai?.feedback) setFeedback(ai.feedback);
  }
  // Замечания и рекомендации ИИ добавляются в конец отзыва; преподаватель правит текст сам.
  function addFindings() {
    const cellWord =
      { русский: 'ячейка', английский: 'cell', english: 'cell' }[
        (review.feedbackLanguage || '').toLowerCase()
      ] ?? 'lahter';
    const lines = ai.findings.map(
      (f) =>
        `- ${f.cell ? `(${cellWord} ${f.cell}) ` : ''}${f.text}${f.recommendation ? ' ' + f.recommendation : ''}`,
    );
    setFeedback((current) => [current.trim(), lines.join('\n')].filter(Boolean).join('\n\n'));
  }
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
        ...review.criteria.map(
          (c, i) =>
            `${c.name}: ${scores[i].points === '' ? '—' : fmt(scores[i].points)} / ${fmt(c.max)}${scores[i].comment ? ' — ' + scores[i].comment : ''}`,
        ),
        `Kokku: ${fmt(sum)} / ${fmt(maximum)}`,
        '',
        feedback,
      ].join('\n');
      const copied = await command('copyReviewText', { ...context, importId: work.importId, text });
      if (!copied.copied) await navigator.clipboard.writeText(copied.text);
      setCopied('Отзыв скопирован');
    });
  }
  const status = review.current?.status;
  return (
    <div className="review">
      <div className="review-head">
        <div>
          <strong>{work.studentName}</strong>
          <small>{work.file}</small>
        </div>
        <span className={`badge badge-${status ?? 'none'}`}>
          {status === 'approved' ? 'Утверждено' : status === 'draft' ? 'Черновик' : 'Не оценена'}
        </span>
      </div>

      {ai ? (
        <div className="ai-banner">
          <Icon name="spark" />
          <span>
            Предложение ИИ · {ai.model} · <b>{fmt(ai.total)}</b> из {fmt(maximum)}
          </span>
          {editing && (
            <button className="secondary" disabled={busy} onClick={acceptAll}>
              Принять всё
            </button>
          )}
        </div>
      ) : (
        <p className="hint">Проверки ИИ ещё нет — можно оценить вручную.</p>
      )}

      <div className="criteria-list">
        {review.criteria.map((c, i) => {
          const proposal = aiFor(c.id);
          const differs =
            proposal && scores[i].points !== '' && Number(scores[i].points) !== proposal.points;
          return (
            <div className="criterion-card" key={c.id}>
              <div className="criterion-main">
                <strong>{c.name}</strong>
                {c.description && <small>{c.description}</small>}
              </div>
              <div className="criterion-ai">
                {proposal ? (
                  <>
                    <span className="ai-points">
                      ИИ: <b>{fmt(proposal.points)}</b> / {fmt(c.max)}
                    </span>
                    {editing && (
                      <button
                        className="quiet accept"
                        disabled={
                          busy ||
                          (Number(scores[i].points) === proposal.points && scores[i].points !== '')
                        }
                        onClick={() => accept(i)}
                        title="Перенести балл и обоснование ИИ"
                      >
                        Принять
                      </button>
                    )}
                  </>
                ) : (
                  <span className="muted">ИИ: —</span>
                )}
              </div>
              <div className="criterion-score">
                <input
                  aria-label={`Балл: ${c.name}`}
                  type="number"
                  min="0"
                  max={c.max}
                  step="0.5"
                  className={differs ? 'differs' : ''}
                  value={scores[i].points}
                  disabled={busy || !editing}
                  onChange={(e) => update(i, { points: e.target.value })}
                />
                <span className="of-max">/ {fmt(c.max)}</span>
              </div>
              {proposal?.justification &&
                scores[i].comment.trim() !== proposal.justification.trim() && (
                  <p className="ai-justification">{proposal.justification}</p>
                )}
              {openComments[c.id] || scores[i].comment ? (
                <div className="criterion-comment">
                  <TextControl
                    as="textarea"
                    rows={2}
                    aria-label={`Комментарий: ${c.name}`}
                    placeholder="Комментарий к критерию"
                    maxLength={10000}
                    value={scores[i].comment}
                    disabled={busy || !editing}
                    onChange={(e) => update(i, { comment: e.target.value })}
                  />
                </div>
              ) : (
                editing && (
                  <button
                    className="quiet add-comment"
                    onClick={() => setOpenComments((o) => ({ ...o, [c.id]: true }))}
                  >
                    + комментарий
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      <div className="review-total">
        <span>
          Сумма: <b>{fmt(sum)}</b> из {fmt(maximum)}
        </span>
        <small className="muted">
          Выставлено {filled} из {review.criteria.length}
        </small>
      </div>

      <div className="feedback-head">
        <h3>Отзыв студенту</h3>
        {editing && ai?.feedback && (
          <button className="quiet" disabled={busy} onClick={() => setFeedback(ai.feedback)}>
            Вставить отзыв ИИ
          </button>
        )}
      </div>
      <TextControl
        as="textarea"
        aria-label="Общий отзыв студенту"
        maxLength={50000}
        value={feedback}
        disabled={busy || !editing}
        onChange={(e) => setFeedback(e.target.value)}
      />

      {ai?.findings?.length > 0 && (
        <details className="ai-findings" open>
          <summary>
            Замечания ИИ ({ai.findings.length})
            {editing && (
              <button
                className="quiet add-findings"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  addFindings();
                }}
              >
                Добавить в отзыв
              </button>
            )}
          </summary>
          <ul>
            {ai.findings.map((f, i) => (
              <li key={i} className={`finding-${f.type}`}>
                <b>{types[f.type]}</b>
                {f.cell ? ` · ячейка ${f.cell}` : ''}: {f.text}
                {f.recommendation && <small>{f.recommendation}</small>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="review-actions">
        <button className="secondary" disabled={busy} onClick={copyFeedback}>
          <Icon name="copy" />
          Скопировать отзыв
        </button>
        <span className="spacer" />
        {editing ? (
          <>
            <button className="secondary" disabled={busy} onClick={() => save('draft')}>
              Сохранить черновик
            </button>
            <button className="primary" disabled={busy} onClick={() => save('approved')}>
              <Icon name="check" />
              Утвердить оценку
            </button>
          </>
        ) : (
          <button className="secondary" onClick={() => setEditing(true)}>
            Создать исправление
          </button>
        )}
      </div>
      <p role="status" className="review-status">
        {copied ||
          (status === 'approved'
            ? 'Оценка утверждена'
            : review.current
              ? 'Черновик сохранён'
              : 'Оценка ещё не сохранена')}
      </p>
      {review.history.length > 1 && (
        <details>
          <summary>История решений ({review.history.length})</summary>
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
    </div>
  );
}
