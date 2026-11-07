import React from 'react';
import { Brand } from '../components/ui/Brand.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { initials } from '../utils/student-display.js';
export function ProfilesPage({ data, busy, mutate, navigate, openModal, error }) {
  return (
    <>
      <div className="login login-simple">
        <section className="login-form">
          <div className="login-box">
            <Brand />
            <h1>{data.profiles.length ? 'Выберите профиль' : 'Создайте первый профиль'}</h1>

            {data.profiles.map((p) => (
              <button
                className="profile-option"
                key={p.id}
                disabled={busy}
                onClick={() => openModal({ type: 'login', profile: p })}
              >
                <span className="avatar">{initials(p.name)}</span>
                <span className="label">
                  <strong>{p.name}</strong>
                  <small>{p.needsPassword ? 'Установите пароль' : 'Вход по паролю'}</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
            <button className="secondary" onClick={() => openModal({ type: 'profile' })}>
              <Icon name="plus" />
              Новый профиль
            </button>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
