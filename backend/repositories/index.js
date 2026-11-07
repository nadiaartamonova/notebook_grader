import { createRepository as profiles } from './profiles-repository.js';
import { createRepository as courses } from './courses-repository.js';
import { createRepository as assignments } from './assignments-repository.js';
import { createRepository as students } from './students-repository.js';
import { createRepository as submissions } from './submissions-repository.js';
export function createRepositories(db) {
  return {
    profiles: profiles(db),
    courses: courses(db),
    assignments: assignments(db),
    students: students(db),
    submissions: submissions(db),
  };
}
