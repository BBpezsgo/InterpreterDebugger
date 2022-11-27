const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const IPCManager = require('./ipc')

/** @type {BrowserWindow} */
var win

function createWindow () {
  win = new BrowserWindow({
    width: 716 - 10,
    height: 659 + 30 - 10 + 23,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false
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
  ipc.Start()
  
  setTimeout(() => {
    ipc.Send({ type: 'get-comp-res' })
  }, 1000)
  
  setInterval(() => {
    ipc.Send({ type: 'get-intp-data' })
    ipc.Send({ type: 'get-intp2-data' })
  }, 1000)
})

ipcMain.on('debug-step', e => {
  ipc.Send({ type: 'intp-update' })
})

ipcMain.on('stop-debug', e => {
  ipc.Stop()
})
