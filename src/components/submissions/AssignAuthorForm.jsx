import React from 'react';
import { command } from '../../api.js';
export function AssignAuthorForm({
  view,
  author,
  busy,
  setAuthor,
  course,
  repeat,
  setRepeat,
  action,
  context,
  onRefresh,
  setView,
}) {
  return (
    <>
      <p>{view.work.file}</p>
      {view.type === 'changeAuthor' && (
        <p className="inline-note">
          Прежний автор: {view.work.studentName}. Назначение останется в истории; копию для ИИ нужно
          будет подготовить заново.
        </p>
      )}
      <label>
        Студент
        <select value={author} disabled={busy} onChange={(e) => setAuthor(e.target.value)}>
          <option value="">Выберите студента</option>
          {course.students
            .filter((s) => view.type !== 'changeAuthor' || s.id !== view.work.studentId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.number || 'без номера'}
              </option>
            ))}
        </select>
      </label>
      <label className="checkline">
        <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
        Если работа уже есть, сохранить новую версию
      </label>
      <button
        className="primary"
        disabled={busy || !author}
        onClick={() =>
          action(async () => {
            await command(
              view.type === 'changeAuthor' ? 'changeSubmissionAuthor' : 'assignSubmission',
              {
                ...context,
                importId: view.work.importId,
                studentId: author,
                expectedAuthorEventId: view.work.authorEventId,
                confirmNewVersion: repeat,
              },
            );
            await onRefresh();
            setView(null);
          })
        }
      >
        {view.type === 'changeAuthor' ? 'Изменить автора' : 'Назначить'}
      </button>
    </>
  );
}
