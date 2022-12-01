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

const processInterpreter = new IPCManager.IPC()
const processEditor = new IPCManager.IPC()

ipcMain.on('on-loaded', e => {
  processInterpreter.on('message', function(message) {
    if (message.type === 'con-out' || message.type === 'intp-data' || message.type === 'intp2-data' || message.type === 'comp-res' || message.type === 'started') {
      win.webContents.send(message.type, message.data)
    }
  })
  
  processInterpreter.on('unknown-message', function(message) {
    win.webContents.send('unknown-message', message)
  })
  
  processInterpreter.on('error', function(error) {
    win.webContents.send('unknown-message', error)
  })
  
  processInterpreter.on('error-message', function(error) {
    win.webContents.send('unknown-message', error)
  })
  
  processInterpreter.on('closed', function(code) {
    win.webContents.send('closed', code)
  })
})

ipcMain.on('start-debug', e => {
  StartDebug()
})

ipcMain.on('debug-step', e => {
  processInterpreter.Send({ type: 'intp-update' })
})

ipcMain.on('stop-debug', e => {
  StopDebug()
})

ipcMain.on('toolbar-dev-tools', e => {
  win.webContents.openDevTools({
    mode: 'undocked'
  })
})

ipcMain.on('get-files', e => {
  if (!fs.existsSync(settings.testFiles)) {
    win.webContents.send('files', [])
    return
  }
  const dir = fs.readdirSync(settings.testFiles)
  win.webContents.send('files', dir)
})

ipcMain.on('run-file', (e, file) => {  
  if (processInterpreter.IsRunning()) { return }
  console.log(`StartDebug('${settings.testFiles + file}')`)
  StartDebug(settings.testFiles + `${file}`)
})

function StartDebug(path) {
  if (processInterpreter.IsRunning() === false) { processInterpreter.Start(path, 'DEBUG') }
  
  setTimeout(() => {
    processInterpreter.Send({ type: 'get-comp-res' })
  }, 1000)
  
  dataInterval = setInterval(() => {
    processInterpreter.Send({ type: 'get-intp-data' })
    processInterpreter.Send({ type: 'get-intp2-data' })
  }, 1000)
}

function StopDebug() {
  if (dataInterval !== null) {
    clearInterval(dataInterval)
  }
  processInterpreter.Stop()
}

ipcMain.on('editor-text', (e, text) => { codeEditorCurrentText = text })

var codeEditorLastText = ''
var codeEditorCurrentText = ''
var codeEditorUpdate = setInterval(() => {
  if (codeEditorLastText !== codeEditorCurrentText) {
    OnCodeEditor(codeEditorCurrentText)
    codeEditorLastText = codeEditorCurrentText
  }
}, 500)

/** @param {string} text */
function OnCodeEditor(text) {
  if (processEditor.IsRunning() === false) {
    console.log('Start editor')
    const path = './editing.temp.txt'
    processEditor.Start(path, 'EDITOR')
    setTimeout(() => {
      CodeEditorSend(text)
    }, 1000)

    processEditor.on('message', function(message) {
      console.log(message)
      if (message.type === 'result') {
        win.webContents.send('editor-tokens', message.data)
      }
    })
    
    processEditor.on('unknown-message', function(message) {
      console.log(message)
    })
    
    processEditor.on('error', function(error) {
      console.log(error)
    })
    
    processEditor.on('error-message', function(error) {
      console.log(error)
    })
    
    processEditor.on('closed', function(code) {
      console.log('Editor closed')
    })
  } else {
    console.log('On edit')
    CodeEditorSend(text)
  }
}

/** @param {string} text */
function CodeEditorSend(text) {
  const path = './editing.temp.txt'
  console.log(text.replace(/\r/g, '\\r').replace(/\n/g, '\\n'))
  fs.writeFile(path, text.replace(/\r/g, '\n\r'), { encoding: 'utf-8' }, (err) => {
    if (err) { console.log(err); return }
    console.log('Get tokens')
    processEditor.Send({ type: 'raw-code', data: '' })
  })
}
