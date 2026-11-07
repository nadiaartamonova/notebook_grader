export function toCriterionDto(row) {
  return { id: row.id, name: row.name, description: row.description, points: row.half_points / 2 };
}
export function toAssignmentDto(row, criteria, works) {
  return {
    ...row,
    criteria,
    max: criteria.reduce((sum, criterion) => sum + criterion.points, 0),
    works,
  };
}
export function toCourseDto(row, rules, students, assignments) {
  return {
    id: row.id,
    owner: row.profile_id,
    name: row.name,
    group: row.group_name,
    year: String(row.year),
    semester: row.semester,
    mode: row.mode,
    rules: rules.content,
    rulesRevision: rules.id,
    rulesVersion: rules.version,
    students,
    assignments,
  };
}
