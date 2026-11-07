import React, { useRef, useState } from 'react';
import { command } from '../../api.js';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Field.jsx';

export function StudentActions({ student, course, profileId, onRefresh }) {
  const [mode, setMode] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const open = (mode) => {
    setError('');
    setMode(mode);
  };
  async function save(form) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await command(mode === 'edit' ? 'editStudent' : 'excludeStudent', {
        profileId,
        courseId: course.id,
        studentId: student.id,
        name: form.get('name'),
        number: form.get('number'),
        confirmExclude: form.get('confirm') === 'on',
      });
      setMode(null);
      await onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="work-actions">
        <button className="secondary" onClick={() => open('edit')}>
          Редактировать студента
        </button>
        <button className="secondary" onClick={() => open('exclude')}>
          Исключить из группы
        </button>
      </div>
      {mode && (
        <Modal
          title={mode === 'edit' ? 'Редактирование студента' : 'Исключение из группы'}
          busy={busy}
          error={error}
          onClose={() => setMode(null)}
          onSubmit={save}
          submit={mode === 'edit' ? 'Сохранить' : 'Исключить'}
        >
          {mode === 'edit' ? (
            <>
              <Field
                label="Имя и фамилия"
                name="name"
                defaultValue={student.name}
                maxLength={100}
                required
              />
              <Field
                label="Учебный номер"
                name="number"
                defaultValue={student.number}
                maxLength={50}
              />
              <p className="hint">
                Карточка общая для курсов этого профиля. Уже подготовленные копии для ИИ не
                изменятся.
              </p>
            </>
          ) : (
            <>
              <p>
                {student.name} · {course.group}
              </p>
              <p>
                Если в курсе есть текущие работы студента, сначала переназначьте или удалите их.
                История сохраняется.
              </p>
              <label className="checkline">
                <input type="checkbox" name="confirm" required />
                Подтверждаю исключение из этой группы
              </label>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
