import React from 'react';
import { Icon } from '../ui/Icon.jsx';
import { initials } from '../../utils/student-display.js';

const fmt = (n) => (n === null || n === undefined ? '—' : String(n).replace('.', ','));
const color = (id) => `hsl(${[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360} 45% 88%)`;

// Шаги работы по порядку. Каждый шаг — кнопка, открывающая нужное окно; цвет показывает состояние.
function steps(w) {
  const copy = !w.preparedId
    ? { tone: 'todo', label: 'Копия', hint: 'Копия для ИИ ещё не подготовлена' }
    : !w.reviewed
      ? { tone: 'warn', label: 'Копия', hint: 'Копию нужно просмотреть и отметить' }
      : !w.aiReady
        ? { tone: 'warn', label: 'Копия', hint: 'Старая копия: подготовьте её заново' }
        : { tone: 'done', label: 'Копия', hint: 'Копия просмотрена' };
  const checks = !w.formal
    ? { tone: 'todo', label: 'Проверки', hint: 'Формальные проверки не запускались' }
    : w.formal.failed
      ? {
          tone: 'bad',
          label: `Проверки · ${w.formal.failed}`,
          hint: `Не пройдено: ${w.formal.failed}`,
        }
      : { tone: 'done', label: 'Проверки', hint: 'Все формальные проверки пройдены' };
  const ai =
    w.aiScore !== null
      ? { tone: 'done', label: 'ИИ', hint: 'Проверка ИИ завершена' }
      : w.aiStatus === 'failed' || w.aiStatus === 'interrupted'
        ? { tone: 'bad', label: 'ИИ', hint: 'Последняя проверка ИИ не удалась' }
        : { tone: 'todo', label: 'ИИ', hint: 'Проверка ИИ не запускалась' };
  const review =
    w.reviewStatus === 'approved'
      ? { tone: 'done', label: 'Оценка', hint: 'Оценка утверждена' }
      : w.reviewStatus === 'draft'
        ? { tone: 'warn', label: 'Черновик', hint: 'Черновик оценки' }
        : { tone: 'todo', label: 'Оценка', hint: 'Не оценена' };
  return [
    ['copy', copy],
    ['checks', checks],
    ['ai', ai],
    ['review', review],
  ];
}

// Следующее действие — одна заметная кнопка; остальное доступно через шаги и значки.
function next(w) {
  if (!w.preparedId || !w.reviewed || !w.aiReady)
    return {
      step: 'copy',
      label: !w.preparedId ? 'Создать копию' : !w.reviewed ? 'Открыть копию' : 'Обновить копию',
      icon: 'file',
    };
  if (w.aiScore === null) return { step: 'ai', label: 'Проверить с ИИ', icon: 'spark' };
  if (w.reviewStatus === 'approved')
    return { step: 'review', label: 'Оценка', icon: 'star', quiet: true };
  return {
    step: 'review',
    label: w.reviewStatus === 'draft' ? 'Продолжить оценку' : 'Оценить',
    icon: 'star',
  };
}

export function WorkRow({
  work: w,
  max,
  busy,
  onStep,
  onAssign,
  onOriginal,
  onHistory,
  onChangeAuthor,
  onDelete,
}) {
  const ready = w.status === 'ready';
  const action = w.studentId && ready ? next(w) : null;
  return (
    <article className={`work-row ${!w.studentId ? 'no-author' : ''}`}>
      <div className="work-who">
        <span
          className={`avatar ${w.studentId ? '' : 'avatar-empty'}`}
          style={w.studentId ? { background: color(w.studentId) } : undefined}
        >
          {w.studentId ? initials(w.studentName) : <Icon name="user" />}
        </span>
        <div>
          <strong>{w.studentName || 'Автор не назначен'}</strong>
          <small title={w.file}>
            {w.file}
            {w.version ? ` · сдача № ${w.version}` : ''}
          </small>
          <small>
            {new Date(w.createdAt).toLocaleString('ru-RU', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </small>
        </div>
      </div>

      <div className="work-steps">
        {w.error && <p className="error">{w.error}</p>}
        {w.status === 'pending' && (
          <p className="error">Импорт прерван. Перезапустите приложение.</p>
        )}
        {w.studentId && ready ? (
          steps(w).map(([key, s], i) => (
            <React.Fragment key={key}>
              <button
                className={`step step-${s.tone}`}
                title={s.hint}
                disabled={busy}
                onClick={() => onStep(key, w)}
              >
                <Icon
                  name={
                    s.tone === 'done'
                      ? 'check'
                      : s.tone === 'bad'
                        ? 'x'
                        : s.tone === 'warn'
                          ? 'eye'
                          : 'minus'
                  }
                />
                {s.label}
              </button>
            </React.Fragment>
          ))
        ) : !w.studentId && ready ? (
          <span className="no-author-note">Назначьте автора, чтобы продолжить</span>
        ) : null}
      </div>

      <div className="work-score" aria-label="Баллы">
        {w.studentId && (w.teacherScore ?? w.draftScore ?? w.aiScore) !== null ? (
          <>
            <b
              className={
                w.reviewStatus === 'approved'
                  ? 'approved'
                  : w.reviewStatus === 'draft'
                    ? 'draft'
                    : 'ai-only'
              }
            >
              {fmt(w.teacherScore ?? w.draftScore ?? w.aiScore)}
              <small> / {fmt(max)}</small>
            </b>
            <small>
              {w.reviewStatus === 'approved'
                ? w.aiScore !== null
                  ? `ИИ: ${fmt(w.aiScore)}`
                  : 'утверждено'
                : w.reviewStatus === 'draft'
                  ? 'черновик'
                  : 'оценка ИИ'}
            </small>
          </>
        ) : null}
      </div>
      <div className="work-buttons">
        {!w.studentId ? (
          <button className="primary" disabled={busy || !ready} onClick={() => onAssign(w)}>
            <Icon name="user" />
            Назначить автора
          </button>
        ) : (
          action && (
            <button
              className={action.quiet ? 'secondary' : 'primary'}
              disabled={busy}
              onClick={() => onStep(action.step, w)}
            >
              <Icon name={action.icon} />
              {action.label}
            </button>
          )
        )}
        <div className="icon-actions">
          <button
            className="icon-btn"
            title="Исходный текст"
            aria-label="Исходный текст"
            disabled={busy || !ready}
            onClick={() => onOriginal(w)}
          >
            <Icon name="eye" />
          </button>
          <button
            className="icon-btn"
            title="История работы"
            aria-label="История работы"
            disabled={busy}
            onClick={() => onHistory(w)}
          >
            <Icon name="clock" />
          </button>
          {w.studentId && (
            <button
              className="icon-btn"
              title="Изменить автора"
              aria-label="Изменить автора"
              disabled={busy || !ready}
              onClick={() => onChangeAuthor(w)}
            >
              <Icon name="userSwap" />
            </button>
          )}
          <button
            className="icon-btn icon-danger"
            title="Удалить работу"
            aria-label="Удалить работу"
            disabled={busy}
            onClick={() => onDelete(w)}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </article>
  );
}
