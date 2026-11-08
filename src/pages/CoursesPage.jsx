import React from 'react';
import { Icon } from '../components/ui/Icon.jsx';
export function CoursesPage({
  data,
  openModal,
  navigate,
  search,
  setSearch,
  year,
  setYear,
  semester,
  setSemester,
}) {
  const visibleCourses = data.courses.filter(
    (c) =>
      (year === 'all' || c.year === year) &&
      (semester === 'all' || c.semester === semester) &&
      `${c.name} ${c.group} ${c.year} ${c.semester} ${c.mode}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <div className="heading">
        <div>
          <h1>Мои курсы</h1>
        </div>
        <button className="primary" onClick={() => openModal({ type: 'course' })}>
          <Icon name="plus" />
          Создать папку курса
        </button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input
            aria-label="Поиск курса или группы"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: дисциплина, группа, год"
          />
        </div>
        <select aria-label="Год" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="all">Все годы</option>
          {[...new Set(data.courses.map((c) => c.year))]
            .sort()
            .reverse()
            .map((y) => (
              <option key={y}>{y}</option>
            ))}
        </select>
        <select aria-label="Семестр" value={semester} onChange={(e) => setSemester(e.target.value)}>
          <option value="all">Все семестры</option>
          <option>Весна</option>
          <option>Осень</option>
        </select>
      </div>
      <div className="section-label">
        Рабочие папки <span>{visibleCourses.length}</span>
      </div>
      <div className="grid">
        {visibleCourses.map((c) => (
          <article className={`course ${c.mode === 'Сессионное' ? 'session' : 'day'}`} key={c.id}>
            <button className="course-body" onClick={() => navigate(c.id)}>
              <div className="course-top">
                <span className="folder">
                  <Icon name="folder" />
                </span>
                <span className="pill">
                  {c.semester} {c.year}
                </span>
              </div>
              <h3>{c.name}</h3>
              <p>
                {c.group} · {c.mode} обучение
              </p>
              <div className="course-meta">
                <span>Задания: {c.assignments.length}</span>
                <span>Студенты: {c.students.length}</span>
              </div>
            </button>
            <div className="course-foot">
              <span>{c.rules ? 'Правила добавлены' : 'Добавьте правила курса'}</span>
              <button className="copy" onClick={() => openModal({ type: 'course', source: c })}>
                <Icon name="copy" />
                Копировать
              </button>
            </div>
          </article>
        ))}
        <button className="addcard" onClick={() => openModal({ type: 'course' })}>
          <span className="circle">
            <Icon name="plus" />
          </span>
          <strong>Новая папка курса</strong>
          <span>Другая группа или новый семестр</span>
        </button>
      </div>
      {data.courses.length > 0 && !visibleCourses.length && (
        <p className="hint">Курсы по выбранным условиям не найдены.</p>
      )}
    </>
  );
}
