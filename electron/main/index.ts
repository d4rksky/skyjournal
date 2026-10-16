import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDb } from './db'
import {
  registerBackupHandlers,
  registerIpcHandlers,
  registerPhotoImportHandlers
} from './ipc'
import appIconPng from '../../resources/icon.png?asset'
import appIconIco from '../../resources/icon.ico?asset'

const resolveAppIcon = (): string => {
  const fileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  if (app.isPackaged) {
    return join(process.resourcesPath, fileName)
  }
  return process.platform === 'win32' ? appIconIco : appIconPng
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 720,
    title: 'SkyJournal',
    icon: resolveAppIcon(),
    backgroundColor: '#f2f2f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // CJS preload + sandbox can leave window.api undefined; disable for a reliable bridge.
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDb()
  registerIpcHandlers()
  // Explicit channels (also invoked inside registerIpcHandlers) so a
  // partial main reload cannot leave preload invokes unbound.
  registerBackupHandlers()
  registerPhotoImportHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
