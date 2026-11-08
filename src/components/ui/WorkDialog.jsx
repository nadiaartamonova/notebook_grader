import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon.jsx';
export function WorkDialog({ title, children, close, busy, small = false }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`work-dialog ${small ? 'small' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="panel-head">
        <h2>{title}</h2>
        <button className="close" aria-label="Закрыть" disabled={busy} onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
