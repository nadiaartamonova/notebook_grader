import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon.jsx';
export function Modal({
  title,
  children,
  onClose,
  onSubmit,
  busy,
  error,
  wide = false,
  submit = 'Сохранить',
}) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'assignment-modal' : ''}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="close" onClick={onClose} disabled={busy} aria-label="Закрыть">
          <Icon name="close" />
        </button>
      </div>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <fieldset disabled={busy}>{children}</fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Сохранение…' : submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
