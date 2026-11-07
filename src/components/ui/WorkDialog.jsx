import React, { useEffect, useRef } from 'react';
export function WorkDialog({ title, children, close, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="work-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="panel-head">
        <h2>{title}</h2>
        <button className="secondary" aria-label="Закрыть" disabled={busy} onClick={close}>
          ×
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
