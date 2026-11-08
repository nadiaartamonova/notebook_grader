import React, { useState } from 'react';
import { Field } from '../ui/Field.jsx';
const labels = {
  filename: 'Имя файла',
  firstCell: 'Первая ячейка — заголовок',
  identity: 'Имя и дата в начале',
  tasks: 'Заголовки и описания задач',
  aiForm: 'Форма об использовании ИИ',
  syntax: 'Синтаксис Python (пока пропускается)',
};
export function FormalChecksFields({ initial }) {
  const [settings, setSettings] = useState(
    () =>
      initial ?? {
        enabled: Object.fromEntries(Object.keys(labels).map((k) => [k, true])),
        filenamePattern: '',
        taskCount: 1,
        aiKeywords: 'AI kasutamise vorm',
      },
  );
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  return (
    <fieldset>
      <legend>Формальные проверки</legend>
      {Object.entries(labels).map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={settings.enabled[key]}
            onChange={(e) => update('enabled', { ...settings.enabled, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <Field
        label="Шаблон имени файла"
        value={settings.filenamePattern}
        maxLength={250}
        placeholder="Task1_{Имя}.ipynb"
        onChange={(e) => update('filenamePattern', e.target.value)}
      />
      <p className="hint">
        {'{Имя}'} — латинские буквы, включая диакритику, без пробелов. Пустой шаблон пропускает
        проверку имени файла.
      </p>
      <Field
        label="Ожидаемое число задач"
        type="number"
        min="1"
        max="1000"
        step="1"
        required
        value={settings.taskCount}
        onChange={(e) => update('taskCount', Number(e.target.value))}
      />
      <Field
        label="Ключевые слова формы ИИ"
        required
        maxLength={250}
        value={settings.aiKeywords}
        onChange={(e) => update('aiKeywords', e.target.value)}
      />
      <p className="hint">
        Форма ищется в последних пяти ячейках. Имя определяется по отдельной строке в первых двух
        ячейках; совпадение с карточкой автора не проверяется.
      </p>
      <input type="hidden" name="formalChecks" value={JSON.stringify(settings)} />
    </fieldset>
  );
}
