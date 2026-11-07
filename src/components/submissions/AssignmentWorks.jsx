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
          Загрузить работы
        </button>
      </div>
      <p className="hint">Ноутбуки .ipynb · до 5 МБ каждый · оригиналы сохраняются на компьютере</p>
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
      {works.map((w) => (
        <article className="work-row" key={w.importId}>
          <div>
            <strong>{w.studentName || 'Автор не назначен'}</strong>
            <p>{w.file}</p>
            <small>
              {w.version ? `Сдача № ${w.version} · ` : ''}
              {new Date(w.createdAt).toLocaleString('ru-RU')}
              {w.preparedId
                ? w.reviewed
                  ? ' · Копия просмотрена'
                  : ' · Копия требует просмотра'
                : ''}
            </small>
            {w.error && <p className="error">{w.error}</p>}
            {w.status === 'pending' && (
              <p>Импорт прерван. Перезапустите приложение для восстановления.</p>
            )}
          </div>
          <div className="grade-summary">
            <span>Оценка ИИ: —</span>
            <span>Оценка преподавателя: {w.teacherScore ?? '—'}</span>
            <span>
              {
                { ungraded: 'Не оценена', draft: 'Черновик', approved: 'Утверждено' }[
                  w.reviewStatus
                ]
              }
            </span>
          </div>
          <div className="work-actions">
            {w.studentId && (
              <button
                className="primary"
                disabled={busy || w.status !== 'ready'}
                onClick={() =>
                  action(async () => {
                    const review = await command('getReview', { ...context, importId: w.importId });
                    open({ type: 'review', work: w, review });
                  })
                }
              >
                Оценить
              </button>
            )}
            {w.studentId && (
              <button
                className="secondary"
                disabled={busy || w.status !== 'ready'}
                onClick={() => open({ type: 'changeAuthor', work: w })}
              >
                Изменить автора
              </button>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() => open({ type: 'delete', work: w })}
            >
              Удалить работу
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  const history = await command('getSubmissionHistory', {
                    ...context,
                    importId: w.importId,
                  });
                  open({ type: 'history', work: w, history });
                })
              }
            >
              История работы
            </button>
            <button
              className="secondary"
              disabled={busy || w.status !== 'ready'}
              onClick={() => inspect(w, false)}
            >
              Исходный текст
            </button>
            {!w.studentId ? (
              <button
                className="secondary"
                disabled={busy || w.status !== 'ready'}
                onClick={() => open({ type: 'assign', work: w })}
              >
                Назначить автора
              </button>
            ) : (
              <button
                className="secondary"
                disabled={busy || w.status !== 'ready'}
                onClick={() => inspect(w, true)}
              >
                Копия для ИИ
              </button>
            )}
          </div>
        </article>
      ))}
      {view && (
        <WorkDialog
          title={
            {
              upload: 'Загрузка работ',
              changeAuthor: 'Изменить автора',
              delete: 'Удаление работы',
              history: 'История работы',
              review: 'Оценка работы',
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
          {view.type === 'review' && (
            <ReviewEditor
              initial={view.review}
              context={context}
              work={view.work}
              {...{ onRefresh, action, busy }}
            />
          )}
          {view.type === 'history' && <WorkHistory history={view.history} />}
          {view.type === 'delete' && (
            <>
              <p>
                Удалить работу «{view.work.file}»
                {view.work.studentName ? ' студента ' + view.work.studentName : ''}?
              </p>
              <p>
                Работа исчезнет из текущих списков. История и файл-оригинал останутся в локальном
                хранилище.
              </p>
              <button className="secondary" disabled={busy} onClick={() => setView(null)}>
                Отмена
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
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
                Подтвердить удаление
              </button>
            </>
          )}
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
