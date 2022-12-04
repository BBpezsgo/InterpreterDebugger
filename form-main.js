const { ipcMain } = require('electron')
const path = require('path')
const Form = require('./form')
const fs = require('fs')

module.exports = class MainForm extends Form {
    constructor() {
        super()

        const settings = require('./settings').Get()
        const IPCManager = require('./ipc')

        /** @type {NodeJS.Timer | null} */
        this.dataInterval = null
                
        const processInterpreter = new IPCManager.IPC()
        const processEditor = new IPCManager.IPC()
        
        const self = this

        ipcMain.on('on-loaded', e => {
          processInterpreter.on('message', function(message) {
            if (self.win === null) { return }
            if (message.type === 'con-out' || message.type === 'intp-data' || message.type === 'intp2-data' || message.type === 'comp-res' || message.type === 'started') {
                self.win.webContents.send(message.type, message.data)
            }
          })
          
          processInterpreter.on('unknown-message', function(message) {
            if (self.win === null) { return }
            self.win.webContents.send('unknown-message', message)
          })
          
          processInterpreter.on('error', function(error) {
            self.win.webContents.send('unknown-message', error)
          })
          
          processInterpreter.on('error-message', function(error) {
            self.win.webContents.send('unknown-message', error)
          })
          
          processInterpreter.on('closed', function(code) {
            self.win.webContents.send('closed', code)
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
            this.win.webContents.openDevTools({
                mode: 'undocked'
            })
        })
        
        ipcMain.on('get-files', e => {
          if (!fs.existsSync(settings.testFiles)) {
            this.win.webContents.send('files', [])
            return
          }
          const dir = fs.readdirSync(settings.testFiles)
          const files = []
          for (let i = 0; i < dir.length; i++) {
            const element = dir[i]
            try {
              if (fs.statSync(path.join(settings.testFiles, element)).isFile()) {
                files.push(element)
              }
            } catch (error) { }
          }
          this.win.webContents.send('files', files)
        })
        
        ipcMain.on('run-file', (e, file) => {  
          if (processInterpreter.IsRunning()) { return }
          console.log(`StartDebug('${settings.testFiles + file}')`)
          StartDebug(settings.testFiles + `${file}`)
        })
        
        const StartDebug = (path) => {
          if (processInterpreter.IsRunning() === false) { processInterpreter.Start(path, 'DEBUG') }
          
          setTimeout(() => {
            processInterpreter.Send({ type: 'get-comp-res' })
          }, 1000)
          
          this.dataInterval = setInterval(() => {
            processInterpreter.Send({ type: 'get-intp-data' })
            processInterpreter.Send({ type: 'get-intp2-data' })
          }, 1000)
        }
        
        const StopDebug = () => {
          if (this.dataInterval !== null) {
            clearInterval(this.dataInterval)
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
        const OnCodeEditor = (text) => {
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
                self.win.webContents.send('editor-tokens', message.data)
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
        const CodeEditorSend = (text) => {
          const path = './editing.temp.txt'
          console.log(text.replace(/\r/g, '\\r').replace(/\n/g, '\\n'))
          fs.writeFile(path, text.replace(/\r/g, '\n\r'), { encoding: 'utf-8' }, (err) => {
            if (err) { console.log(err); return }
            console.log('Get tokens')
            processEditor.Send({ type: 'raw-code', data: '' })
          })
        }
    }
    
    CreateWindow() {
      this.InitWindow('MainForm', './forms/main/index.html', {
          width: 716 - 16,
          height: 659
            + 30 // Top toolbar
            - 10 // idk
            + 23 // Bottom statusbar
            - 49 // Windows toolbar
          ,
          webPreferences: {
            preload: path.join(__dirname, 'forms/main/preload.js')
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
    }
}
