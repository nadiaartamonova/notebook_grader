import { AuthDialog } from './AuthDialog.jsx';
import React from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Field.jsx';
import { CourseForm } from './CourseForm.jsx';
import { AssignmentEditor } from './AssignmentEditor.jsx';
export function WorkspaceDialogs({
  modal,
  busy,
  modalError,
  setModal,
  mutate,
  navigate,
  setSearch,
  setYear,
  setSemester,
  course,
  policy,
  openModal,
}) {
  if (!modal) return null;
  const common = {
    busy,
    error: modalError,
    onClose: () => {
      if (!busy) setModal(null);
    },
  };
  if (['profile', 'login', 'recover', 'changePassword', 'recoveryCode'].includes(modal.type))
    return (
      <AuthDialog
        modal={modal}
        {...common}
        policy={policy}
        mutate={mutate}
        navigate={navigate}
        openModal={openModal}
      />
    );
  if (modal.type === 'course')
    return (
      <Modal
        {...common}
        title={modal.source ? 'Копировать курс' : 'Новая папка курса'}
        submit={modal.source ? 'Создать копию' : 'Создать курс'}
        onSubmit={(f) =>
          mutate(
            modal.source ? 'copyCourse' : 'createCourse',
            { ...Object.fromEntries(f), sourceId: modal.source?.id },
            modal.source ? 'Независимая копия курса сохранена' : 'Курс сохранён',
            () => {
              setSearch('');
              setYear('all');
              setSemester('all');
              navigate();
            },
          )
        }
      >
        <CourseForm source={modal.source} />
      </Modal>
    );
  if (modal.type === 'student')
    return (
      <Modal
        {...common}
        title="Новый студент"
        onSubmit={(f) =>
          mutate(
            'addStudent',
            { ...Object.fromEntries(f), courseId: course.id },
            'Студент добавлен',
          )
        }
      >
        <Field label="Имя и фамилия" name="name" required maxLength={100} />
        <Field label="Учебный номер (необязательно)" name="number" maxLength={50} />
        <p className="hint">
          Номер помогает отличать однофамильцев и связать студента с несколькими курсами. Без номера
          создаётся отдельная карточка студента.
        </p>
      </Modal>
    );
  if (modal.type === 'assignment')
    return (
      <Modal
        {...common}
        wide
        title={modal.assignment ? 'Редактирование задания' : 'Новое задание'}
        onSubmit={(f) =>
          mutate(
            'saveAssignment',
            {
              ...Object.fromEntries(f),
              criteria: JSON.parse(f.get('criteria')),
              courseId: course.id,
              id: modal.assignment?.id,
              expectedRevision: modal.assignment?.revision_id,
            },
            'Задание и критерии сохранены',
          )
        }
      >
        <AssignmentEditor assignment={modal.assignment} />
      </Modal>
    );
}
