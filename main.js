const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const IPCManager = require('./ipc')
const fs = require('fs')
const settings = require('./settings').Get()

/** @type {BrowserWindow} */
var win
/** @type {NodeJS.Timer | null} */
var dataInterval = null

function createWindow () {
  win = new BrowserWindow({
    width: 716 - 16,
    height: 659
      + 30 // Top toolbar
      - 10 // idk
      + 23 // Bottom statusbar
      - 49 // Windows toolbar
    ,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false,
    icon: './icon.ico',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1f1f1f',
      symbolColor: '#999',
      height: 30
    }
  })

  win.loadFile('./gui/index.html')
}

app.whenReady().then(() => {
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

const ipc = new IPCManager.IPC()

ipcMain.on('on-loaded', e => {
  ipc.on('message', function(message) {
    if (message.type === 'con-out' || message.type === 'intp-data' || message.type === 'intp2-data' || message.type === 'comp-res' || message.type === 'started') {
      win.webContents.send(message.type, message.data)
    }
  })
  
  ipc.on('unknown-message', function(message) {
    win.webContents.send('unknown-message', message)
  })
  
  ipc.on('error', function(error) {
    win.webContents.send('unknown-message', error)
  })
  
  ipc.on('error-message', function(error) {
    win.webContents.send('unknown-message', error)
  })
  
  ipc.on('closed', function(code) {
    win.webContents.send('closed', code)
  })
})

ipcMain.on('start-debug', e => {
  StartDebug()
})

ipcMain.on('debug-step', e => {
  ipc.Send({ type: 'intp-update' })
})

ipcMain.on('stop-debug', e => {
  StopDebug()
})

ipcMain.on('get-files', e => {  
  const dir = fs.readdirSync(settings.testFiles)
  win.webContents.send('files', dir)
})

ipcMain.on('run-file', (e, file) => {  
  if (ipc.IsRunning()) { return }
  console.log(`StartDebug('${settings.testFiles + file}')`)
  StartDebug(settings.testFiles + `${file}`)
})

function StartDebug(path) {
  ipc.Start(path)
  
  setTimeout(() => {
    ipc.Send({ type: 'get-comp-res' })
  }, 1000)
  
  dataInterval = setInterval(() => {
    ipc.Send({ type: 'get-intp-data' })
    ipc.Send({ type: 'get-intp2-data' })
  }, 1000)
}

function StopDebug() {
  if (dataInterval !== null) {
    clearInterval(dataInterval)
  }
  ipc.Stop()
}
