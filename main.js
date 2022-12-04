const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')

const MainFormManager = require('./form-main')
const SetupFormManager = require('./form-setup')

/** @type {MainFormManager | null} */
var MainForm = null
/** @type {SetupFormManager | null} */
var SetupForm = null

app.whenReady().then(() => {
  console.log('App:', 'ready')

  if (fs.existsSync('./settings.json')) {
    MainForm = new MainFormManager()
    MainForm.CreateWindow()
  } else {
    SetupForm = new SetupFormManager()
    SetupForm.CreateWindow()
    
    ipcMain.on('on-setup', (e, path) => {
      fs.writeFileSync('./settings.json', JSON.stringify({
          path: path,
          testFiles: './'
      }, null, ' '), 'utf-8')
      SetupForm.Close()
      SetupForm = null
      
      MainForm = new MainFormManager()
      MainForm.CreateWindow()
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      MainForm.CreateWindow()
    }
  })
})

app.on('window-all-closed', () => {
  console.log('App:', 'window-all-closed')

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', (e, a) => { console.log('App:', 'activate') })
app.on('before-quit', (e) => { console.log('App:', 'before-quit') })
app.on('quit', (e, a) => { console.log('App:', 'quit', 'exitcode:', a) })
app.on('will-quit', (e) => { console.log('App:', 'will-quit') })