import React from 'react';
import { Brand } from '../ui/Brand.jsx';
import { Icon } from '../ui/Icon.jsx';
import { initials } from '../../utils/student-display.js';
export function Sidebar({ data, course, profile, busy, navigate, mutate, openModal }) {
  return (
    <aside className="side">
      <Brand />
      <div className="side-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <button className={`nav ${!course ? 'active' : ''}`} onClick={() => navigate()}>
        <Icon name="folder" />
        Мои курсы <small>{data.courses.length}</small>
      </button>
      <nav className="course-nav" aria-label="Курсы">
        {data.courses.map((c) => (
          <button
            key={c.id}
            className={`course-nav-item ${c.mode === 'Сессионное' ? 'session' : 'day'} ${course?.id === c.id ? 'selected' : ''}`}
            aria-current={course?.id === c.id ? 'page' : undefined}
            onClick={() => navigate(c.id)}
          >
            <span className="course-nav-icon">
              <Icon name="folder" />
            </span>
            <span className="course-nav-label">
              <strong>{c.name}</strong>
              <small>{c.group}</small>
              <small>
                {c.mode} · {c.semester} {c.year}
              </small>
            </span>
          </button>
        ))}
      </nav>
      <button className="quiet" onClick={() => openModal({ type: 'aiSettings' })}>
        Подключение ИИ
      </button>
      <button className="quiet" onClick={() => openModal({ type: 'changePassword', profile })}>
        Сменить пароль
      </button>
      <button
        className="profile-btn"
        disabled={busy}
        onClick={() => mutate('leaveProfile', {}, '', () => navigate())}
      >
        <span className="avatar">{initials(profile.name)}</span>
        <span>
          {profile.name}
          <small>Сменить профиль</small>
        </span>
      </button>
    </aside>
  );
}
