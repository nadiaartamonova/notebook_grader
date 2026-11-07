import React from 'react';
import { Modal } from '../ui/Modal.jsx';
import { WorkDialog } from '../ui/WorkDialog.jsx';
import { Field } from '../ui/Field.jsx';

export function AuthDialog({ modal, busy, error, onClose, mutate, navigate, policy, openModal }) {
  if (modal.type === 'recoveryCode')
    return (
      <WorkDialog title="Сохраните код восстановления" busy={false} close={onClose}>
        <p>
          Код показывается один раз. Сохраните его отдельно: без пароля и этого кода доступ к
          профилю через приложение не восстановить.
        </p>
        <code className="recovery-code">{modal.code}</code>
        <p>Прежний код восстановления больше не действует.</p>
        <button className="primary" onClick={onClose}>
          Я сохранил код
        </button>
      </WorkDialog>
    );
  const mode =
    modal.type === 'profile'
      ? 'createProfile'
      : modal.type === 'changePassword'
        ? 'changePassword'
        : modal.type === 'recover'
          ? 'recoverProfile'
          : modal.profile.needsPassword
            ? 'setupPassword'
            : 'selectProfile';
  const newPassword = mode !== 'selectProfile';
  const titles = {
    createProfile: 'Новый профиль',
    selectProfile: 'Вход в профиль',
    setupPassword: 'Установите пароль',
    changePassword: 'Смена пароля',
    recoverProfile: 'Восстановление доступа',
  };
  return (
    <Modal
      key={mode}
      title={titles[mode]}
      busy={busy}
      error={error}
      onClose={onClose}
      submit={mode === 'selectProfile' ? 'Войти' : 'Сохранить'}
      onSubmit={(form) =>
        mutate(
          mode,
          { ...Object.fromEntries(form), id: modal.profile?.id },
          mode === 'selectProfile' ? 'Вход выполнен' : 'Пароль сохранён',
          () => navigate(),
        )
      }
    >
      {mode === 'createProfile' ? (
        <Field label="Имя преподавателя" name="name" maxLength={100} required />
      ) : (
        <p>{modal.profile?.name}</p>
      )}
      {mode === 'setupPassword' && (
        <p>В этом профиле ещё нет пароля. Задайте его для первого входа.</p>
      )}
      {mode === 'changePassword' && (
        <Field
          label="Текущий пароль"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      )}
      {mode === 'recoverProfile' && (
        <Field label="Код восстановления" name="recoveryCode" autoComplete="off" required />
      )}
      <Field
        label={newPassword ? 'Новый пароль' : 'Пароль'}
        type="password"
        name="password"
        autoComplete={newPassword ? 'new-password' : 'current-password'}
        required
      />
      {newPassword && (
        <>
          <Field
            label="Повторите пароль"
            type="password"
            name="passwordRepeat"
            autoComplete="new-password"
            required
          />
          <p className="hint">
            {policy.mode === 'test'
              ? 'Режим разработки: пароль от 1 символа.'
              : 'Не меньше 8 символов и хотя бы один спецсимвол (не буква и не цифра).'}
          </p>
        </>
      )}
      {mode === 'selectProfile' && (
        <button
          type="button"
          className="quiet"
          onClick={() => openModal({ type: 'recover', profile: modal.profile })}
        >
          Забыли пароль?
        </button>
      )}
    </Modal>
  );
}
