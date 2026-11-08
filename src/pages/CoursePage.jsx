import React from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { AssignmentPage } from './AssignmentPage.jsx';
import { AssignmentsPage } from './AssignmentsPage.jsx';
import { RulesPage } from './RulesPage.jsx';
import { StudentsPage } from './StudentsPage.jsx';
export function CoursePage({
  assignment,
  course,
  data,
  load,
  route,
  navigate,
  openModal,
  mutate,
  busy,
}) {
  return (
    <>
      <button className="quiet back" onClick={() => navigate(assignment ? course.id : null)}>
        <Icon name="back" />
        {assignment ? course.name : 'Все курсы'}
      </button>
      <div className="heading">
        <div>
          <h1>{assignment ? assignment.name : course.name}</h1>
          <p>
            {course.group} · {course.mode} обучение · {course.semester} {course.year}
            {assignment ? ` · До ${assignment.max} баллов` : ''}
          </p>
        </div>
        {assignment ? (
          <div className="heading-tools">
            <span className="pill">Версия {assignment.version}</span>
            <button
              className="icon-btn"
              title="Редактировать задание"
              aria-label="Редактировать задание"
              onClick={() => openModal({ type: 'assignment', assignment })}
            >
              <Icon name="pencil" />
            </button>
          </div>
        ) : (
          <button
            className="secondary"
            onClick={() => openModal({ type: 'course', source: course })}
          >
            <Icon name="copy" />
            Копировать курс
          </button>
        )}
      </div>
      {assignment ? (
        <AssignmentPage {...{ assignment, course, data, load }} />
      ) : (
        <>
          <div className="tabs tabs-row">
            {[
              ['assignments', 'Задания'],
              ['rules', 'Правила курса'],
              ['students', 'Студенты'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`tab ${route.tab === key ? 'active' : ''}`}
                onClick={() => navigate(course.id, null, key)}
              >
                {label}
              </button>
            ))}
            <span className="tabs-spacer" />
            {route.tab === 'assignments' && (
              <button
                className="primary tab-action"
                onClick={() => openModal({ type: 'assignment' })}
              >
                <Icon name="plus" />
                Добавить задание
              </button>
            )}
            {route.tab === 'students' && (
              <button className="primary tab-action" onClick={() => openModal({ type: 'student' })}>
                <Icon name="plus" />
                Добавить студента
              </button>
            )}
          </div>
          {route.tab === 'assignments' && (
            <AssignmentsPage
              {...{ course, openModal, navigate }}
              profileId={data.active}
              onRefresh={load}
            />
          )}
          {route.tab === 'rules' && <RulesPage {...{ course, mutate, busy }} />}
          {route.tab === 'students' && <StudentsPage {...{ course, openModal, data, load }} />}
        </>
      )}
    </>
  );
}
