import React from 'react';
import { Field } from '../ui/Field.jsx';
export function CourseForm({ source }) {
  return (
    <>
      {source && (
        <p className="modal-desc">
          Правила и задания будут скопированы. Студенты, работы и оценки не переносятся.
        </p>
      )}
      <Field
        label="Название дисциплины"
        name="name"
        defaultValue={source?.name || ''}
        required
        maxLength={100}
      />
      <Field
        label="Группа и курс"
        name="group"
        defaultValue={source ? `${source.group} — копия` : ''}
        placeholder="Например: ПЛП · 1 курс"
        required
        maxLength={100}
      />
      <div className="form-row">
        <Field
          label="Год"
          name="year"
          type="number"
          defaultValue={source?.year || new Date().getFullYear()}
          min="2000"
          max="2100"
          required
        />
        <label>
          Семестр
          <select name="semester" defaultValue={source?.semester || 'Весна'}>
            <option>Весна</option>
            <option>Осень</option>
          </select>
        </label>
      </div>
      <label>
        Форма обучения
        <select name="mode" defaultValue={source?.mode || 'Дневное'}>
          <option>Дневное</option>
          <option>Сессионное</option>
        </select>
      </label>
    </>
  );
}
