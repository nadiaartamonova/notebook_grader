import React from 'react';
import { StudentCards } from '../components/students/StudentCards.jsx';
export function StudentsPage({ course, openModal, data, load }) {
  return (
    <section className="panel">
      <StudentCards key={course.id} course={course} profileId={data.active} onRefresh={load} />
    </section>
  );
}
