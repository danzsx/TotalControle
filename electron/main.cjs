const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'tc-card',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

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
    try {
      fs.copyFileSync(paths.main, paths.backup);
    } catch {
      // Ignora falha transitória ao atualizar backup para não bloquear escrita principal
    }
  }
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.renameSync(paths.temp, paths.main);
      return;
    } catch (err) {
      lastErr = err;
      if (err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES')) {
        // Fallback em Windows quando antivírus/OneDrive segura o handle do arquivo principal
        try {
          fs.copyFileSync(paths.temp, paths.main);
          try {
            fs.unlinkSync(paths.temp);
          } catch {
            // ok
          }
          return;
        } catch (copyErr) {
          lastErr = copyErr;
        }
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

function readDbBinary() {
  const paths = getDbPaths();
  if (fs.existsSync(paths.main)) {
    return { source: 'main', bytes: new Uint8Array(fs.readFileSync(paths.main)) };
  }
  if (fs.existsSync(paths.backup)) {
    return { source: 'backup', bytes: new Uint8Array(fs.readFileSync(paths.backup)) };
  }
  return { source: 'none', bytes: null };
}

function quarantineCorruptDb() {
  const paths = getDbPaths();
  let quarantinedPath = null;
  if (fs.existsSync(paths.main)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    quarantinedPath = path.join(paths.dir, `totalcontrole.corrupt-${stamp}.sqlite`);
    fs.renameSync(paths.main, quarantinedPath);
  }
  if (fs.existsSync(paths.backup)) {
    return {
      quarantinedPath,
      backupBytes: new Uint8Array(fs.readFileSync(paths.backup)),
    };
  }
  return { quarantinedPath, backupBytes: null };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#F6F6F3',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    title: 'TotalControle — Gestão Integrada da Aprendizagem',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
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

function getBundledCardsDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'cards');
  }
  return path.join(__dirname, '../public/cards');
}

function getUserCardsDir() {
  return path.join(getDataDir(), 'cards');
}

function syncMissingCardImages(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      syncMissingCardImages(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

app.whenReady().then(() => {
  syncMissingCardImages(getBundledCardsDir(), getUserCardsDir());

  protocol.handle('tc-card', (request) => {
    try {
      const url = new URL(request.url);
      const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const userRoot = path.resolve(getUserCardsDir());
      const targetPath = path.resolve(userRoot, relPath);
      if (!targetPath.startsWith(userRoot)) {
        return new Response('Forbidden', { status: 403 });
      }
      if (fs.existsSync(targetPath)) {
        return net.fetch(pathToFileURL(targetPath).toString());
      }
      const bundledPath = path.resolve(getBundledCardsDir(), relPath);
      if (fs.existsSync(bundledPath)) {
        return net.fetch(pathToFileURL(bundledPath).toString());
      }
      return new Response('Not Found', { status: 404 });
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
  });
  ipcMain.handle('db:load', () => {
    try {
      return { ok: true, ...readDbBinary() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('db:save', (_event, bytesInput) => {
    try {
      const buf = Buffer.isBuffer(bytesInput)
        ? bytesInput
        : bytesInput instanceof Uint8Array
          ? Buffer.from(bytesInput.buffer, bytesInput.byteOffset, bytesInput.byteLength)
          : Buffer.from(bytesInput);
      writeAtomicBinary(buf);
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

  ipcMain.handle('db:reveal-folder', async () => {
    try {
      const paths = getDbPaths();
      fs.mkdirSync(paths.dir, { recursive: true });
      await shell.openPath(paths.dir);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('files:export', async (_event, { defaultName, content, filters }) => {
    try {
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
    } catch (err) {
      return { canceled: true, error: err.message };
    }
  });

  ipcMain.handle('files:export-sqlite', async (_event, { defaultName, bytesArray }) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
      });
      if (canceled || !filePath) return { canceled: true };
      const buf =
        bytesArray instanceof Uint8Array
          ? Buffer.from(bytesArray.buffer, bytesArray.byteOffset, bytesArray.byteLength)
          : Buffer.from(bytesArray);
      fs.writeFileSync(filePath, buf);
      return { canceled: false, filePath };
    } catch (err) {
      return { canceled: true, error: err.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

