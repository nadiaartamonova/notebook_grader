import React, { useEffect, useRef, useState } from 'react';
import { Brand } from '../ui/Brand.jsx';
import { Icon } from '../ui/Icon.jsx';
import { initials } from '../../utils/student-display.js';
export function Sidebar({ data, course, profile, busy, navigate, mutate, openModal }) {
  const [menu, setMenu] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target))
        setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);
  function pick(fn) {
    setMenu(false);
    fn();
  }
  return (
    <aside className="side">
      <Brand />
      <div className={`courses-head ${!course ? 'active' : ''}`}>
        <button className="courses-link" onClick={() => navigate()}>
          Мои курсы <small>{data.courses.length}</small>
        </button>
        <button
          className={`courses-toggle ${collapsed ? 'collapsed' : ''}`}
          aria-label={collapsed ? 'Показать курсы' : 'Свернуть курсы'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name="chevron" />
        </button>
      </div>
      <nav className="course-nav" aria-label="Курсы" hidden={collapsed}>
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
      <div className="profile-menu-wrap" ref={ref}>
        {menu && (
          <div className="profile-menu" role="menu" aria-label="Меню профиля">
            <button role="menuitem" onClick={() => pick(() => openModal({ type: 'aiSettings' }))}>
              Подключение ИИ
            </button>
            <button
              role="menuitem"
              onClick={() => pick(() => openModal({ type: 'changePassword', profile }))}
            >
              Сменить пароль
            </button>
            <button
              role="menuitem"
              disabled={busy}
              onClick={() => pick(() => mutate('leaveProfile', {}, '', () => navigate()))}
            >
              Выйти из профиля
            </button>
          </div>
        )}
        <button
          className="profile-btn"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <span className="avatar">{initials(profile.name)}</span>
          <span>{profile.name}</span>
        </button>
      </div>
    </aside>
  );
}
