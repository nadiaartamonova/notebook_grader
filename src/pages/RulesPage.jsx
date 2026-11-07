import { TextControl } from '../components/ui/TextControl.jsx';
import React from 'react';
export function RulesPage({ course, mutate, busy }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Общие требования</h2>
        <span className="pill">Версия {course.rulesVersion}</span>
      </div>
      <form
        key={course.rulesRevision}
        onSubmit={(e) => {
          e.preventDefault();
          const content = new FormData(e.currentTarget).get('content');
          mutate(
            'saveRules',
            { courseId: course.id, expectedRevision: course.rulesRevision, content },
            'Новая версия правил сохранена',
          );
        }}
      >
        <label>
          Текст правил
          <TextControl
            as="textarea"
            rows="10"
            name="content"
            defaultValue={course.rules}
            maxLength={100000}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Сохранение…' : 'Сохранить правила'}
        </button>
        <p className="hint">
          Предыдущие версии сохраняются. Задания используют правила, действовавшие при их
          сохранении. Импорт документов подключим отдельно.
        </p>
      </form>
    </section>
  );
}
