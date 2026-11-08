const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
let store;
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const { Store, UserError } = await import('../backend/store.js');
      const dataDirectory = app.isPackaged
        ? join(app.getPath('userData'), 'data')
        : join(__dirname, '..', '.local-data');
      store = new Store(dataDirectory, {
        passwordMode: app.isPackaged ? 'strict' : 'test',
        aiDevelopment: !app.isPackaged,
      });
      const page = pathToFileURL(join(__dirname, '..', 'build', 'index.html')).href;
      ipcMain.handle('practicum:command', async (event, command, payload) => {
        if (
          !event.senderFrame ||
          event.senderFrame !== event.sender.mainFrame ||
          event.senderFrame.url !== page
        )
          throw new Error('Недопустимый источник запроса.');
        try {
          let data = await store.dispatch(command, payload);
          if (command === 'copyReviewText') {
            clipboard.writeText(data.text);
            data = { copied: true };
          }
          return { ok: true, data };
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof UserError
                ? error.message
                : 'Не удалось сохранить данные. Повторите попытку. Если ошибка сохраняется, проверьте свободное место на диске.',
          };
        }
      });
      const window = new BrowserWindow({
        width: 1280,
        height: 880,
        minWidth: 800,
        minHeight: 600,
        title: 'Практикум',
        show: false,
        webPreferences: {
          preload: join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      window.setMenuBarVisibility(false);
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', (event) => event.preventDefault());
      window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      window.once('ready-to-show', () => window.show());
      await window.loadURL(page);
    })
    .catch((error) => {
      dialog.showErrorBox(
        'Практикум не удалось открыть',
        'Не удалось открыть локальную базу или интерфейс. Данные не удалены.\n' + error.message,
      );
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => store?.close());
}
