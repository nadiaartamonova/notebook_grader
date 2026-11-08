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
            <Brand large />
            {!data.profiles.length && <h1>Создайте первый профиль</h1>}

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
                  {p.needsPassword ? <small>Установите пароль</small> : null}
                </span>
                <Icon name="arrow" />
              </button>
            ))}
            <button
              className="profile-add"
              aria-label="Новый профиль"
              title="Новый профиль"
              onClick={() => openModal({ type: 'profile' })}
            >
              <Icon name="plus" />
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
