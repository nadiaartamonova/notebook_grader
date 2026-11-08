import React from 'react';
import { WorkDialog } from './WorkDialog.jsx';
// Одно простое окно подтверждения для всех действий: вопрос, пояснение, «Отмена» и действие.
export function ConfirmDialog({
  title,
  children,
  confirm = 'Подтвердить',
  danger = false,
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  return (
    <WorkDialog title={title} busy={busy} close={onCancel} small>
      <div className="confirm-text">{children}</div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="secondary" disabled={busy} onClick={onCancel}>
          Отмена
        </button>
        <button className={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
          {busy ? 'Подождите…' : confirm}
        </button>
      </div>
    </WorkDialog>
  );
}
