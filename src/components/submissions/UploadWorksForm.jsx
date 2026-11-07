import React from 'react';
export function UploadWorksForm({
  student,
  assignment,
  busy,
  setRows,
  rows,
  course,
  repeat,
  setRepeat,
  upload,
}) {
  return (
    <>
      <p>{student ? `${student.name} · ${assignment.name}` : assignment.name}</p>
      <input
        aria-label="Выберите ноутбуки"
        type="file"
        accept=".ipynb"
        multiple
        disabled={busy}
        onChange={(e) =>
          setRows(Array.from(e.target.files).map((file) => ({ file, studentId: '', saved: false })))
        }
      />
      {rows.map((r, i) => (
        <div className="upload-row" key={i}>
          <strong>{r.file.name}</strong>
          {!student && (
            <select
              aria-label={`Автор ${r.file.name}`}
              disabled={busy || r.saved}
              value={r.studentId}
              onChange={(e) =>
                setRows(
                  rows.map((row, j) => (j === i ? { ...row, studentId: e.target.value } : row)),
                )
              }
            >
              <option value="">Автор не назначен</option>
              {course.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.number || 'без номера'}
                </option>
              ))}
            </select>
          )}
          <small role="status">{r.message}</small>
        </div>
      ))}
      <label className="checkline">
        <input
          type="checkbox"
          checked={repeat}
          disabled={busy}
          onChange={(e) => setRepeat(e.target.checked)}
        />
        При повторной сдаче сохранить новую версию
      </label>
      <p className="hint">
        Автор не определяется по имени файла. Работы без автора можно распределить после загрузки.
      </p>
      <button className="primary" disabled={busy || !rows.some((r) => !r.saved)} onClick={upload}>
        {busy ? 'Загрузка…' : 'Сохранить файлы'}
      </button>
    </>
  );
}
