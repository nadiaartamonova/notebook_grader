import { AiSettings } from './components/forms/AiSettings.jsx';
import { WorkDialog } from './components/ui/WorkDialog.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { command } from './api.js';
import { Brand } from './components/ui/Brand.jsx';
import { WorkspaceDialogs } from './components/forms/WorkspaceDialogs.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { ProfilesPage } from './pages/ProfilesPage.jsx';
import { CoursesPage } from './pages/CoursesPage.jsx';
import { CoursePage } from './pages/CoursePage.jsx';
export function App() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [route, setRoute] = useState({ course: null, assignment: null, tab: 'assignments' });
  const [modal, setModal] = useState(null),
    [modalError, setModalError] = useState(''),
    [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''),
    [year, setYear] = useState('all'),
    [semester, setSemester] = useState('all');
  const lock = useRef(false);
  async function load() {
    try {
      setData(await command('state'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const profile = data?.profiles.find((p) => p.id === data.active);
  const course = data?.courses.find((c) => c.id === route.course);
  const assignment = course?.assignments.find((a) => a.id === route.assignment);
  function openModal(value) {
    setModalError('');
    setModal(value);
  }
  function navigate(courseId = null, assignmentId = null, tab = 'assignments') {
    setRoute({ course: courseId, assignment: assignmentId, tab });
    setError('');
  }
  async function mutate(name, payload, success, after) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setModalError('');
    setError('');
    try {
      const updated = await command(name, { profileId: data?.active, ...payload });
      const { recoveryCode, ...state } = updated;
      setData(state);
      setModal(recoveryCode ? { type: 'recoveryCode', code: recoveryCode } : null);
      setNotice(success || 'Сохранено');
      after?.();
    } catch (e) {
      if (modal) setModalError(e.message);
      else setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="startup">
        <Brand />
        <h1>{error ? 'Не удалось открыть данные' : 'Открываем данные…'}</h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button className="primary" onClick={load}>
              Повторить
            </button>
          </>
        )}
      </div>
    );
  const dialogs =
    modal?.type === 'aiSettings' && profile ? (
      <WorkDialog title="Подключение ИИ" close={() => setModal(null)}>
        <AiSettings profileId={profile.id} />
      </WorkDialog>
    ) : (
      <WorkspaceDialogs
        {...{
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
          policy: data.passwordPolicy,
          openModal,
        }}
      />
    );
  if (!profile)
    return (
      <>
        <ProfilesPage {...{ data, busy, mutate, navigate, openModal, error }} />
        {dialogs}
      </>
    );
  return (
    <>
      <div className="app">
        <Sidebar {...{ data, course, profile, busy, navigate, mutate, openModal }} />
        <main className="main">
          {course?.group && (
            <header className="topbar">
              <span>{course.group}</span>
            </header>
          )}
          <div className="content">
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            {course ? (
              <CoursePage
                {...{ assignment, course, data, load, route, navigate, openModal, mutate, busy }}
              />
            ) : (
              <CoursesPage
                {...{
                  data,
                  openModal,
                  navigate,
                  search,
                  setSearch,
                  year,
                  setYear,
                  semester,
                  setSemester,
                }}
              />
            )}
          </div>
        </main>
      </div>
      {dialogs}
      <div id="toast" role="status" className={notice ? 'show' : ''}>
        {notice}
      </div>
    </>
  );
}
