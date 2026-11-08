import React, { useState } from 'react';
import { command } from '../api.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
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
      <label className="checkline archive-toggle">
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
        <ConfirmDialog
          title="Архивировать задание?"
          confirm="Подтвердить архивирование"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => change(confirm, true)}
        >
          <p>
            <strong>{confirm.name}</strong>
          </p>
          <p className="muted">Задание скроется из списка. Работы и история сохранятся.</p>
        </ConfirmDialog>
      )}
      {assignments.length ? (
        assignments.map((a, index) => (
          <div className="assignment" key={a.id}>
            <button
              className="assignment-open"
              aria-label="Открыть задание"
              title={a.name}
              onClick={() => navigate(course.id, a.id)}
            >
              <span className="number">{String(index + 1).padStart(2, '0')}</span>
              <span className="assignment-main">
                <h3>{a.name}</h3>
                <p>
                  До {String(a.max).replace('.', ',')} баллов · {a.works.length}{' '}
                  {a.works.length === 1
                    ? 'работа'
                    : a.works.length >= 2 && a.works.length <= 4
                      ? 'работы'
                      : 'работ'}
                </p>
              </span>
              <span className="open-label">
                Открыть <Icon name="arrow" />
              </span>
            </button>
            <button
              className="icon-btn"
              disabled={busy}
              title={a.archived ? 'Восстановить из архива' : 'Архивировать'}
              aria-label={a.archived ? 'Восстановить' : 'Архивировать'}
              onClick={() => (a.archived ? change(a, false) : setConfirm(a))}
            >
              <Icon name={a.archived ? 'restore' : 'archive'} />
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
