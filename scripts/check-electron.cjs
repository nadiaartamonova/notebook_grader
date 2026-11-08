// Run with Electron, not the system Node: verifies both bundled SQLite and the sandboxed preload.
const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { mkdtempSync, rmSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
app.setPath('userData', mkdtempSync(join(tmpdir(), 'practicum-electron-session-')));
app.disableHardwareAcceleration();
app
  .whenReady()
  .then(async () => {
    const { Store, UserError } = await import('../backend/store.js');
    const directory = mkdtempSync(join(tmpdir(), 'practicum-electron-check-'));
    let store;
    let copiedFeedback;
    try {
      store = new Store(directory);
      const created = await store.dispatch('createProfile', {
        name: 'Проверка Electron',
        password: 'test',
        passwordRepeat: 'test',
      });
      store.close();
      store = new Store(directory);
      if (store.active() !== null) throw Error('Session persisted');
      await store.dispatch('selectProfile', { id: created.active, password: 'test' });
      const page = pathToFileURL(join(__dirname, '..', 'build', 'index.html')).href;
      ipcMain.handle('practicum:command', async (event, command, payload) => {
        if (event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== page)
          throw Error('Unexpected sender');
        try {
          const data = await store.dispatch(command, payload);
          if (command === 'copyReviewText') {
            copiedFeedback = data.text;
            return { ok: true, data: { copied: true } };
          }
          return { ok: true, data };
        } catch (error) {
          if (error instanceof UserError) return { ok: false, error: error.message };
          throw error;
        }
      });
      const window = new BrowserWindow({
        show: false,
        width: 1280,
        height: 900,
        webPreferences: {
          offscreen: true,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          preload: join(__dirname, '..', 'desktop', 'preload.cjs'),
        },
      });
      await window.loadURL(page);
      const result = await window.webContents.executeJavaScript(
        'window.practicum.state().then(r => ({ok:r.ok, profiles:r.data.profiles.length, nodeAccess:typeof window.require}))',
      );
      if (!result.ok || result.profiles !== 1 || result.nodeAccess !== 'undefined')
        throw Error('Preload or isolation check failed');
      await window.webContents.executeJavaScript(`(async()=>{
      const call=async(name,p)=>{const r=await window.practicum[name](p);if(!r.ok)throw Error(r.error);return r.data;};
      const profileId=(await call('state')).active;
      let state=await call('createCourse',{profileId,name:'Программирование на Python',group:'ПЛП · 1 курс',year:2026,semester:'Осень',mode:'Дневное'});
      const courseId=state.courses[0].id;
      state=await call('addStudent',{profileId,courseId,name:'Тестовый Студент',number:'TEST-001'});
      const studentId=state.courses[0].students[0].id;
      state=await call('saveAssignment',{profileId,courseId,name:'Структуры данных',description:'Создайте словарь.',additional:'',criteria:[{name:'Логика',points:5}]});
      const assignmentId=state.courses[0].assignments[0].id;
      await call('importNotebook',{profileId,courseId,assignmentId,studentId,name:'test.ipynb',base64:btoa(JSON.stringify({nbformat:4,cells:[{cell_type:'code',source:'print(42)'}]}))});
    })()`);
      await window.loadURL(page);
      const ui = await window.webContents.executeJavaScript(`(async()=>{
      const until=async(fn)=>{for(let i=0;i<100;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,50));}throw Error('UI timeout');};
      const button=async(text)=>{const el=await until(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(text)));el.click();};
      await button('Программирование на Python');await button('Студенты');await button('Тестовый Студент');
      await until(()=>document.body.innerText.includes('test.ipynb'));
      await button('Копия для ИИ');await until(()=>document.querySelector('.payload-editor'));
      if(!document.querySelector('.payload-editor').value.includes('print(42)'))throw Error('Missing prepared code');
      await button('Сохранить копию');await until(()=>!document.querySelector('.work-dialog'));
      await button('Исходный текст');await until(()=>document.querySelector('.source-text'));
      if(document.querySelector('.source-text').textContent!=='print(42)')throw Error('Missing original');
      await button('×');await until(()=>!document.querySelector('.work-dialog'));
      await button('Правила курса');await until(()=>document.querySelector('textarea[name="content"]'));
      await button('Задания');await button('Открыть');await until(()=>document.body.innerText.includes('Критерии оценивания'));
      await button('Редактировать задание');await until(()=>document.querySelector('dialog[open] input[name="name"]'));
      await button('Отмена');await until(()=>!document.querySelector('dialog[open]'));
      await button('Мои курсы');await until(()=>document.querySelector('.grid'));
      await button('Создать папку курса');await until(()=>document.querySelector('dialog[open] select[name="semester"]'));
      await button('Отмена');await until(()=>!document.querySelector('dialog[open]'));
      await button('Сменить профиль');await until(()=>document.body.innerText.includes('Выберите профиль'));
      await button('Проверка Electron');
      const password=await until(()=>document.querySelector('input[name="password"]'));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(password,'test');password.dispatchEvent(new Event('input',{bubbles:true}));
      await button('Войти');await until(()=>document.querySelector('.grid'));
      await button('Программирование на Python');await button('Студенты');await button('Тестовый Студент');
      await until(()=>document.body.innerText.includes('test.ipynb'));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return {studentCard:true,preparedCopy:true,original:true,pages:true,forms:true};
    })()`);
      const lifecycleUi = await require('../tests/electron-lifecycle.cjs')(window, page);
      const formalChecksUi = await require('../tests/electron-formal-checks.cjs')(window);
      const authReviewUi = await require('../tests/electron-auth-review.cjs')(window);
      if (!copiedFeedback?.includes('4.5 / 5')) throw Error('Feedback export omitted scores');
      mkdirSync(join(__dirname, '..', '.test-data'), { recursive: true });
      writeFileSync(
        join(__dirname, '..', '.test-data', 'student-card.png'),
        (await window.webContents.capturePage()).toPNG(),
      );
      console.log(
        JSON.stringify({
          electron: process.versions.electron,
          node: process.versions.node,
          sqlite: process.versions.sqlite,
          persisted: true,
          preload: result,
          ui,
          lifecycleUi,
          authReviewUi,
          formalChecksUi,
        }),
      );
      window.destroy();
    } finally {
      store?.close();
      rmSync(directory, { recursive: true, force: true });
    }
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
