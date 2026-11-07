import React from 'react';
export function OriginalPreview({ view }) {
  return (
    <>
      <p>{view.result.file}</p>
      <p className="hint">
        Код не запускается. Выводы и вложения не отображаются; разметка показана текстом.
      </p>
      {view.result.cells.map((c) => (
        <div key={c.number}>
          <h3>
            Ячейка {c.number} ·{' '}
            {c.type === 'code' ? 'код' : c.type === 'markdown' ? 'текст' : 'необработанный текст'}
          </h3>
          <pre className="source-text">{c.source}</pre>
        </div>
      ))}
    </>
  );
}
