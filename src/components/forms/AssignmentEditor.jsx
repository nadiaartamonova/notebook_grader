import { TextControl } from '../ui/TextControl.jsx';
import React, { useState } from 'react';
import { Field } from '../ui/Field.jsx';
import { Icon } from '../ui/Icon.jsx';
export function AssignmentEditor({ assignment }) {
  const [criteria, setCriteria] = useState(() =>
    assignment?.criteria.length
      ? assignment.criteria
      : [{ id: crypto.randomUUID(), name: '', description: '', points: 5 }],
  );
  function update(id, property, value) {
    setCriteria((rows) => rows.map((row) => (row.id === id ? { ...row, [property]: value } : row)));
  }
  return (
    <>
      <Field
        label="Название задания"
        name="name"
        defaultValue={assignment?.name || ''}
        required
        maxLength={120}
      />
      <label>
        Условие задания
        <TextControl
          as="textarea"
          name="description"
          defaultValue={assignment?.description || ''}
          maxLength={100000}
          placeholder="Что должен сделать студент?"
        />
      </label>
      <h3>Критерии оценивания</h3>
      <p className="hint">Максимальная оценка складывается из баллов по критериям.</p>
      {criteria.map((row) => (
        <div className="criterion-row" key={row.id}>
          <div className="criterion-fields">
            <Field
              label="Критерий"
              value={row.name}
              onChange={(e) => update(row.id, 'name', e.target.value)}
              required
              maxLength={150}
            />
            <Field
              label="Баллы"
              type="number"
              value={row.points}
              onChange={(e) => update(row.id, 'points', e.target.value)}
              min="0.5"
              max="1000"
              step="0.5"
              required
            />
          </div>
          <label>
            За что начислять или снижать баллы
            <TextControl
              as="textarea"
              value={row.description}
              onChange={(e) => update(row.id, 'description', e.target.value)}
              maxLength={10000}
              placeholder="Опишите полное и частичное выполнение критерия."
            />
          </label>
          <button
            className="quiet"
            type="button"
            onClick={() => setCriteria((rows) => rows.filter((r) => r.id !== row.id))}
          >
            Удалить критерий
          </button>
        </div>
      ))}
      <input
        type="hidden"
        name="criteria"
        value={JSON.stringify(criteria.map((r) => ({ ...r, points: Number(r.points) })))}
      />
      <button
        className="secondary"
        type="button"
        disabled={criteria.length >= 50}
        onClick={() =>
          setCriteria((rows) => [
            ...rows,
            { id: crypto.randomUUID(), name: '', description: '', points: 1 },
          ])
        }
      >
        <Icon name="plus" />
        Добавить критерий
      </button>
      <p className="total">
        Максимальный балл: {criteria.reduce((sum, row) => sum + Number(row.points || 0), 0)}
      </p>
      <label>
        Дополнительные требования
        <TextControl
          as="textarea"
          name="additional"
          defaultValue={assignment?.additional || ''}
          maxLength={50000}
        />
      </label>
      <p className="hint">Чтобы требование влияло на оценку, добавьте его в критерии с баллами.</p>
      {assignment && (
        <p className="hint">
          Изменения сохранятся новой версией. Предыдущая версия останется в базе.
        </p>
      )}
    </>
  );
}
