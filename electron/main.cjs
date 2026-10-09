const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  { pathToFileURL } = require('node:url');
const {
  MAX_FILE,
  MAX_TOTAL,
  MAX_EXPORT,
  kinds,
  safeName,
  checkedBytes,
  assetPath,
  trustedFrame,
  allowedExternal,
} = require('./policy.cjs');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jara',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);
app.setAppUserModelId('com.jaramiyo.jarastudio');
let mainWindow,
  recoveryQueue = Promise.resolve(),
  closeConfirmed = false,
  closeDialog = false;
const unsavedModules = new Set();
const recoveryPath = () => path.join(app.getPath('userData'), 'recovery.jara');
function trusted(event) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame ||
    !trustedFrame(event.senderFrame.url)
  )
    throw Error('Unavailable outside the local editor.');
}
function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    trusted(event);
    return callback(...args);
  });
}
async function atomicWrite(destination, bytes) {
  const temporary = destination + '.jara-tmp-' + Date.now();
  await fs.writeFile(temporary, bytes, { flag: 'wx' });
  try {
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
async function readBounded(filename, max = MAX_FILE) {
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > max) throw Error('File exceeds the local editor limit.');
  return new Uint8Array(await fs.readFile(filename));
}
function isArchive(bytes) {
  return (
    bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
  );
}
async function save(options, project = false) {
  const bytes = checkedBytes(options?.bytes, project ? MAX_TOTAL : MAX_EXPORT);
  if (project && !isArchive(bytes)) throw Error('Invalid Jara project archive.');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: project ? 'Guardar proyecto · Save project' : 'Exportar · Export',
    defaultPath: safeName(options?.name, project ? 'Untitled.jara' : 'jara-export.bin'),
    ...(project ? { filters: [{ name: 'Jara Studio project', extensions: ['jara'] }] } : {}),
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await atomicWrite(result.filePath, bytes);
  return { canceled: false, name: path.basename(result.filePath) };
}
function registerIPC() {
  handle('jara:version', () => app.getVersion());
  handle('jara:set-unsaved', (module, dirty) => {
    if (
      !['scene', 'handling', 'textures', 'map', 'resources'].includes(module) ||
      typeof dirty !== 'boolean'
    )
      throw Error('Invalid workspace state.');
    dirty ? unsavedModules.add(module) : unsavedModules.delete(module);
    return { unsaved: unsavedModules.size > 0 };
  });
  handle('jara:open-files', async (options) => {
    const extensions = kinds[options?.kind] || kinds.any,
      result = await dialog.showOpenDialog(mainWindow, {
        title: 'Importar archivos · Import files',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Archivos de creación · Creator files', extensions }],
      });
    if (result.canceled) return [];
    if (result.filePaths.length > 128) throw Error('Select at most 128 files.');
    let total = 0;
    const output = [];
    for (const filename of result.filePaths) {
      const data = await readBounded(filename);
      total += data.length;
      if (total > MAX_TOTAL) throw Error('Selection exceeds 256 MB.');
      output.push({ name: path.basename(filename), size: data.length, data });
    }
    return output;
  });
  handle('jara:save-file', (options) => save(options));
  handle('jara:save-project', (options) => save(options, true));
  handle('jara:open-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Abrir proyecto · Open project',
      properties: ['openFile'],
      filters: [{ name: 'Jara Studio project', extensions: ['jara'] }],
    });
    if (result.canceled) return { canceled: true };
    const data = await readBounded(result.filePaths[0], MAX_TOTAL);
    if (!isArchive(data)) throw Error('Invalid Jara project.');
    return { canceled: false, name: path.basename(result.filePaths[0]), data };
  });
  handle('jara:save-recovery', (value) => {
    const bytes = Buffer.from(checkedBytes(value, MAX_FILE));
    if (!isArchive(bytes)) throw Error('Invalid recovery archive.');
    const write = recoveryQueue.then(async () => {
      await fs.mkdir(path.dirname(recoveryPath()), { recursive: true });
      await atomicWrite(recoveryPath(), bytes);
    });
    recoveryQueue = write.catch(() => {});
    return write.then(() => ({ saved: true }));
  });
  handle('jara:load-recovery', async () => {
    await recoveryQueue;
    try {
      return { data: await readBounded(recoveryPath(), MAX_FILE) };
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  });
  handle('jara:clear-recovery', async () => {
    await recoveryQueue;
    await fs.rm(recoveryPath(), { force: true });
    return { cleared: true };
  });
  handle('jara:open-external', async (url) => {
    if (!allowedExternal(url)) throw Error('External address not allowed.');
    await shell.openExternal(url);
    return { opened: true };
  });
}
function menu() {
  const command = (name) => mainWindow?.webContents.send('jara:command', name);
  return Menu.buildFromTemplate([
    {
      label: 'Archivo / File',
      submenu: [
        { label: 'Importar / Import', accelerator: 'CmdOrCtrl+I', click: () => command('import') },
        {
          label: 'Abrir proyecto / Open project',
          accelerator: 'CmdOrCtrl+O',
          click: () => command('open'),
        },
        {
          label: 'Guardar proyecto / Save project',
          accelerator: 'CmdOrCtrl+S',
          click: () => command('save'),
        },
        { type: 'separator' },
        {
          label: 'Exportar GLB / Export GLB',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => command('export'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir / Quit' },
      ],
    },
    {
      label: 'Vista / View',
      submenu: [
        { role: 'togglefullscreen', label: 'Pantalla completa / Fullscreen' },
        { role: 'resetZoom', label: 'Escala de interfaz / Reset UI zoom' },
        { role: 'zoomIn', label: 'Aumentar interfaz / Zoom UI in' },
        { role: 'zoomOut', label: 'Reducir interfaz / Zoom UI out' },
      ],
    },
    {
      label: 'Ayuda / Help',
      submenu: [
        { label: 'Guía / Guide', click: () => command('help') },
        { label: 'Jaramiyo', click: () => shell.openExternal('https://jaramiyo.com/') },
        {
          label: 'Código / Source',
          click: () => shell.openExternal('https://github.com/JaramiyoSM/jara-studio'),
        },
        {
          label: 'Acerca de / About',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Jara Studio',
              message: `Jara Studio ${app.getVersion()}`,
              detail:
                'Jaramiyo · Herramientas locales para creadores FiveM.\nProyectos y exportaciones permanecen en tu equipo.\nModels require compatible GTA preparation before in-game use.',
            }),
        },
      ],
    },
  ]);
}
app.whenReady().then(async () => {
  const root = path.join(app.getAppPath(), 'dist');
  protocol.handle('jara', async (request) => {
    try {
      const filename = assetPath(root, request.url);
      if (!(await fs.stat(filename)).isFile()) throw Error('Not found');
      return await net.fetch(pathToFileURL(filename).href);
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 1020,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: '#181219',
    title: 'Jara Studio',
    icon: path.join(app.getAppPath(), 'build/icon.png'),
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!trustedFrame(url)) event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_details, callback) => callback({ cancel: true }),
  );
  mainWindow.on('close', async (event) => {
    if (closeConfirmed || !unsavedModules.size) return;
    event.preventDefault();
    if (closeDialog) return;
    closeDialog = true;
    try {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Cambios sin guardar · Unsaved work',
        message:
          'Hay trabajo sin guardar o mesas abiertas. / There is unsaved work or open utility data.',
        detail:
          'Vuelve al estudio para guardar tu proyecto y exportar las utilidades. La recuperación puede no contener los últimos cambios. / Return to save your project and export utilities. Recovery may not contain recent changes.',
        buttons: ['Volver / Go back', 'Descartar y salir / Discard and quit'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (result.response === 1) {
        closeConfirmed = true;
        mainWindow.close();
      }
    } finally {
      closeDialog = false;
    }
  });
  registerIPC();
  Menu.setApplicationMenu(menu());
  await mainWindow.loadURL('jara://studio/index.html');
  mainWindow.show();
});
app.on('window-all-closed', () => app.quit());
