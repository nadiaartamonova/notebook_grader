import { AiCheckPanel } from './AiCheckPanel.jsx';
import { FormalChecksView } from './FormalChecksView.jsx';
import { ReviewEditor } from './ReviewEditor.jsx';
import { WorkHistory } from './WorkHistory.jsx';
import { PreparedCopyEditor } from './PreparedCopyEditor.jsx';
import { OriginalPreview } from './OriginalPreview.jsx';
import { AssignAuthorForm } from './AssignAuthorForm.jsx';
import { UploadWorksForm } from './UploadWorksForm.jsx';
import React, { useRef, useState } from 'react';
import { command } from '../../api.js';
import { readBase64 } from '../../utils/read-file.js';
import { WorkDialog } from '../ui/WorkDialog.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { WorkRow } from './WorkRow.jsx';
import { Icon } from '../ui/Icon.jsx';
export function AssignmentWorks({ course, assignment, student, profileId, onRefresh }) {
  const [view, setView] = useState(null),
    [rows, setRows] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [repeat, setRepeat] = useState(false),
    [author, setAuthor] = useState(''),
    [copy, setCopy] = useState(null),
    [body, setBody] = useState(''),
    [reviewed, setReviewed] = useState(false);
  const lock = useRef(false);
  const context = { profileId, courseId: course.id, assignmentId: assignment.id };
  const works = assignment.works.filter((w) => !student || w.studentId === student.id);
  function open(next) {
    setError('');
    setView(next);
    setRepeat(false);
    setAuthor('');
  }
  async function action(fn) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function inspect(work, prepared) {
    await action(async () => {
      const result = await command(prepared ? 'prepareSubmission' : 'readSubmission', {
        ...context,
        importId: work.importId,
      });
      if (prepared) {
        setCopy(result);
        setBody(result.body);
        setReviewed(Boolean(result.reviewed));
        await onRefresh();
      }
      open({ type: prepared ? 'copy' : 'original', work, result });
    });
  }
  async function upload() {
    await action(async () => {
      const updated = [...rows];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].saved) continue;
        try {
          const row = updated[i];
          if (row.file.size > 5 * 1024 * 1024) throw new Error('Файл превышает 5 МБ.');
          await command('importNotebook', {
            ...context,
            name: row.file.name,
            base64: await readBase64(row.file),
            studentId: student?.id || row.studentId || null,
            confirmNewVersion: repeat,
          });
          updated[i] = { ...row, saved: true, message: 'Сохранено' };
        } catch (e) {
          updated[i] = { ...updated[i], message: e.message };
        }
        setRows([...updated]);
      }
      await onRefresh();
    });
  }
  // Шаги строки работы: копия → формальные проверки → ИИ → оценка.
  function step(key, w) {
    if (key === 'copy') return inspect(w, true);
    if (key === 'ai') return open({ type: 'ai', work: w });
    if (key === 'checks')
      return action(async () => {
        const checks = await command('getFormalChecks', { ...context, importId: w.importId });
        open({ type: 'checks', work: w, checks });
      });
    if (key === 'review')
      return action(async () => {
        const review = await command('getReview', { ...context, importId: w.importId });
        open({ type: 'review', work: w, review });
      });
  }
  return (
    <section className="panel work-panel">
      <div className="panel-head">
        <h2>Работы {student ? 'студента' : 'студентов'}</h2>
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            setRows([]);
            open({ type: 'upload' });
          }}
        >
          <Icon name="upload" />
          Загрузить работы
        </button>
      </div>
      {error && !view && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!works.length && (
        <div className="empty">
          <h3>Работ пока нет</h3>
          <p>Загрузите один или несколько файлов. Повторная сдача сохранится отдельной версией.</p>
        </div>
      )}
      {works.length > 0 && (
        <div className="work-list">
          {works.map((w) => (
            <WorkRow
              key={w.importId}
              work={w}
              max={assignment.max}
              busy={busy}
              onStep={step}
              onAssign={(work) => open({ type: 'assign', work })}
              onChangeAuthor={(work) => open({ type: 'changeAuthor', work })}
              onDelete={(work) => open({ type: 'delete', work })}
              onOriginal={(work) => inspect(work, false)}
              onHistory={(work) =>
                action(async () => {
                  const history = await command('getSubmissionHistory', {
                    ...context,
                    importId: work.importId,
                  });
                  open({ type: 'history', work, history });
                })
              }
            />
          ))}
        </div>
      )}
      {view?.type === 'delete' && (
        <ConfirmDialog
          title="Удалить работу?"
          confirm="Удалить"
          danger
          busy={busy}
          error={error}
          onCancel={() => setView(null)}
          onConfirm={() =>
            action(async () => {
              await command('deleteSubmission', {
                ...context,
                importId: view.work.importId,
                confirmDelete: true,
              });
              await onRefresh();
              setView(null);
            })
          }
        >
          <p>
            <strong>{view.work.studentName || 'Автор не назначен'}</strong> · {view.work.file}
          </p>
          <p className="muted">
            Работа исчезнет из списка. Файл и история останутся на компьютере.
          </p>
        </ConfirmDialog>
      )}
      {view && view.type !== 'delete' && (
        <WorkDialog
          title={
            {
              upload: 'Загрузка работ',
              changeAuthor: 'Изменить автора',
              history: 'История работы',
              review: 'Оценка работы',
              checks: 'Формальные проверки',
              ai: 'Проверка с ИИ',
              assign: 'Автор работы',
              original: 'Исходный текст',
              copy: 'Подготовка копии для ИИ',
            }[view.type]
          }
          busy={busy}
          close={() => setView(null)}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {view.type === 'upload' && (
            <UploadWorksForm
              {...{ student, assignment, busy, setRows, rows, course, repeat, setRepeat, upload }}
            />
          )}
          {(view.type === 'assign' || view.type === 'changeAuthor') && (
            <AssignAuthorForm
              {...{
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
              }}
            />
          )}
          {view.type === 'checks' && (
            <FormalChecksView
              initial={view.checks}
              context={context}
              work={view.work}
              busy={busy}
              action={action}
            />
          )}
          {view.type === 'ai' && (
            <AiCheckPanel
              context={context}
              work={view.work}
              onRefresh={onRefresh}
              onReview={() => step('review', view.work)}
            />
          )}
          {view.type === 'review' && (
            <ReviewEditor
              initial={view.review}
              context={context}
              work={view.work}
              {...{ onRefresh, action, busy }}
            />
          )}
          {view.type === 'history' && <WorkHistory history={view.history} />}
          {view.type === 'original' && <OriginalPreview {...{ view }} />}
          {view.type === 'copy' && (
            <PreparedCopyEditor
              {...{
                copy,
                busy,
                body,
                setBody,
                setReviewed,
                reviewed,
                action,
                context,
                view,
                setCopy,
                onRefresh,
                setView,
              }}
            />
          )}
        </WorkDialog>
      )}
    </section>
  );
}
