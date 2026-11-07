import { StudentActions } from './StudentActions.jsx';
import React, { useState } from 'react';
import { initials } from '../../utils/student-display.js';
import { AssignmentWorks } from '../submissions/AssignmentWorks.jsx';
const color = (id) => `hsl(${[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360} 45% 88%)`;
export function StudentCards({ course, profileId, onRefresh }) {
  const [selected, select] = useState(null),
    [assignmentId, setAssignment] = useState('');
  const student = course.students.find((s) => s.id === selected);
  const activeAssignments = course.assignments.filter((a) => !a.archived);
  const assignment = activeAssignments.find((a) => a.id === assignmentId) || activeAssignments[0];
  if (!student)
    return (
      <div className="student-grid">
        {course.students.map((s) => (
          <button key={s.id} className="student-card" onClick={() => select(s.id)}>
            <span className="avatar" style={{ background: color(s.id) }}>
              {initials(s.name)}
            </span>
            <strong>{s.name}</strong>
            <small>{s.number || 'Без учебного номера'}</small>
            <span>Открыть работы →</span>
          </button>
        ))}
        {!course.students.length && <p className="hint">Добавьте первого студента группы.</p>}
      </div>
    );
  return (
    <>
      <button className="quiet" onClick={() => select(null)}>
        ← Все студенты
      </button>
      <h2>{student.name}</h2>
      <p>Учебный номер: {student.number || 'не указан'}</p>
      <StudentActions key={student.id} {...{ student, course, profileId, onRefresh }} />
      <label>
        Задание
        <select value={assignment?.id || ''} onChange={(e) => setAssignment(e.target.value)}>
          {activeAssignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {assignment ? (
        <AssignmentWorks
          key={`${student.id}/${assignment.id}`}
          {...{ course, assignment, student, profileId, onRefresh }}
        />
      ) : (
        <p>Сначала добавьте задание курса.</p>
      )}
    </>
  );
}
