import React, { useState } from 'react';
import { command } from '../api.js';
import { WorkDialog } from '../components/ui/WorkDialog.jsx';
import { Icon } from '../components/ui/Icon.jsx';
export function AssignmentsPage({ course, openModal, navigate, profileId, onRefresh }) {
  const [showArchive, setShowArchive] = useState(false),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const assignments = course.assignments.filter((a) => Boolean(a.archived) === showArchive);
  async function change(a, archive) {
    setBusy(true);
    setError('');
    try {
      await command(archive ? 'archiveAssignment' : 'restoreAssignment', {
        profileId,
        courseId: course.id,
        assignmentId: a.id,
        confirmArchive: archive,
      });
      await onRefresh();
      setConfirm(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Задания курса</h2>
        <button className="primary" onClick={() => openModal({ type: 'assignment' })}>
          <Icon name="plus" />
          Добавить задание
        </button>
      </div>
      <label className="checkline">
        <input
          type="checkbox"
          checked={showArchive}
          onChange={(e) => setShowArchive(e.target.checked)}
        />
        Показать архив
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {confirm && (
        <WorkDialog title="Архивировать задание?" busy={busy} close={() => setConfirm(null)}>
          <p>{confirm.name}. Работы и история сохранятся.</p>
          <button className="primary" disabled={busy} onClick={() => change(confirm, true)}>
            Подтвердить архивирование
          </button>
        </WorkDialog>
      )}
      {assignments.length ? (
        assignments.map((a, index) => (
          <div className="assignment" key={a.id}>
            <span className="number">{String(index + 1).padStart(2, '0')}</span>
            <div className="assignment-main">
              <h3>{a.name}</h3>
              <p>
                До {a.max} баллов · Версия {a.version}
              </p>
            </div>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => (a.archived ? change(a, false) : setConfirm(a))}
            >
              {a.archived ? 'Восстановить' : 'Архивировать'}
            </button>
            <button className="secondary" onClick={() => navigate(course.id, a.id)}>
              Открыть <Icon name="arrow" />
            </button>
          </div>
        ))
      ) : (
        <div className="empty">
          <h3>{showArchive ? 'Архив пуст' : 'Нет активных заданий'}</h3>
        </div>
      )}
    </section>
  );
}
