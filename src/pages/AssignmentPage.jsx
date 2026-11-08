import React from 'react';
import { AssignmentWorks } from '../components/submissions/AssignmentWorks.jsx';
export function AssignmentPage({ assignment, course, data, load }) {
  return (
    <>
      <section className="panel rubric-panel">
        <div className="panel-head">
          <h3>Условие задания</h3>
        </div>
        <p className="criterion-description">
          {assignment.description || 'Описание пока не добавлено.'}
        </p>
      </section>
      <section className="panel rubric-panel">
        <div className="panel-head">
          <h3>Критерии оценивания</h3>
          <span className="pill">Максимум: {assignment.max}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Критерий</th>
                <th>Баллы</th>
              </tr>
            </thead>
            <tbody>
              {assignment.criteria.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <small className="criterion-description">{c.description}</small>
                  </td>
                  <td>{c.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="section-space">Дополнительные требования</h3>
        <p className="criterion-description muted">{assignment.additional || 'Не указаны.'}</p>
        <p className="hint">Требования без баллов сами по себе не снижают оценку.</p>
        {assignment.rule_revision_id !== course.rulesRevision && (
          <div className="inline-note">
            Правила курса изменились после сохранения задания. При следующем сохранении задания
            будет создана версия с текущими правилами.
          </div>
        )}
      </section>
      <AssignmentWorks
        key={assignment.id}
        course={course}
        assignment={assignment}
        profileId={data.active}
        onRefresh={load}
      />
    </>
  );
}
