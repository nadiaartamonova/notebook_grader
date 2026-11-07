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
        <button
          className="secondary"
          onClick={() =>
            openModal(
              assignment ? { type: 'assignment', assignment } : { type: 'course', source: course },
            )
          }
        >
          {assignment ? (
            'Редактировать задание'
          ) : (
            <>
              <Icon name="copy" />
              Копировать курс
            </>
          )}
        </button>
      </div>
      {assignment ? (
        <AssignmentPage {...{ assignment, course, data, load }} />
      ) : (
        <>
          <div className="tabs">
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
