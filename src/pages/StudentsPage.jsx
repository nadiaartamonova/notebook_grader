import React from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { StudentCards } from '../components/students/StudentCards.jsx';
export function StudentsPage({ course, openModal, data, load }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Студенты группы</h2>
        <button className="primary" onClick={() => openModal({ type: 'student' })}>
          <Icon name="plus" />
          Добавить студента
        </button>
      </div>
      <StudentCards key={course.id} course={course} profileId={data.active} onRefresh={load} />
    </section>
  );
}
