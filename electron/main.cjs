const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DB_FILENAME = 'totalcontrole.sqlite';
const DB_BACKUP_FILENAME = 'totalcontrole.bak.sqlite';
const DB_TEMP_FILENAME = 'totalcontrole.sqlite.tmp';

function getDataDir() {
  return process.env.TOTALCONTROLE_DATA_DIR || app.getPath('userData');
}

function getDbPaths() {
  const dir = getDataDir();
  return {
    dir,
    main: path.join(dir, DB_FILENAME),
    backup: path.join(dir, DB_BACKUP_FILENAME),
    temp: path.join(dir, DB_TEMP_FILENAME),
  };
}

function writeAtomicBinary(buffer) {
  const paths = getDbPaths();
  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(paths.temp, buffer);
  if (fs.existsSync(paths.main)) {
    fs.copyFileSync(paths.main, paths.backup);
  }
  fs.renameSync(paths.temp, paths.main);
}

function readDbBinary() {
  const paths = getDbPaths();
  if (fs.existsSync(paths.main)) {
    return { source: 'main', bytes: Array.from(fs.readFileSync(paths.main)) };
  }
  if (fs.existsSync(paths.backup)) {
    return { source: 'backup', bytes: Array.from(fs.readFileSync(paths.backup)) };
  }
  return { source: 'none', bytes: null };
}

function quarantineCorruptDb() {
  const paths = getDbPaths();
  if (!fs.existsSync(paths.main)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(paths.dir, `totalcontrole.corrupt-${stamp}.sqlite`);
  fs.renameSync(paths.main, target);
  if (fs.existsSync(paths.backup)) {
    return { quarantinedPath: target, backupBytes: Array.from(fs.readFileSync(paths.backup)) };
  }
  return { quarantinedPath: target, backupBytes: null };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#F6F6F3',
    autoHideMenuBar: true,
    title: 'TotalControle — Gestão Integrada da Aprendizagem',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (!app.isPackaged && process.env.VITE_DEV !== '0') {
    const devUrl = 'http://127.0.0.1:5173';
    win.loadURL(devUrl).catch(() => {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('db:load', () => {
    try {
      return { ok: true, ...readDbBinary() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:save', (_event, bytesArray) => {
    try {
      writeAtomicBinary(Buffer.from(bytesArray));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:quarantine', () => {
    try {
      return { ok: true, ...quarantineCorruptDb() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:location', () => {
    const paths = getDbPaths();
    return {
      dir: paths.dir,
      dbPath: paths.main,
      backupPath: paths.backup,
      exists: fs.existsSync(paths.main),
      sizeBytes: fs.existsSync(paths.main) ? fs.statSync(paths.main).size : 0,
    };
  });

  ipcMain.handle('db:reveal-folder', () => {
    const paths = getDbPaths();
    fs.mkdirSync(paths.dir, { recursive: true });
    shell.openPath(paths.dir);
    return true;
  });

  ipcMain.handle('files:export', async (_event, { defaultName, content, filters }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: filters || [
        { name: 'JSON Backup', extensions: ['json'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, content, 'utf-8');
    return { canceled: false, filePath };
  });

  ipcMain.handle('files:export-sqlite', async (_event, { defaultName, bytesArray }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, Buffer.from(bytesArray));
    return { canceled: false, filePath };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

