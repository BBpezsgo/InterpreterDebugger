const { BrowserWindow } = require('electron')

module.exports = class Form {
    constructor() {
        /** @type {BrowserWindow | null} */
        this.win = null
    }

    /** @param {string} id @param {string} fileHtml @param {Electron.BrowserWindowConstructorOptions} options */
    InitWindow(id, fileHtml, options) {
        console.log(id + ':', 'loading')
        
        this.win = new BrowserWindow(options)      
        this.win.loadFile(fileHtml)

        this.win.on('close', (e) => { console.log(id + ':', 'close') })
        this.win.on('closed', () => { console.log(id + ':', 'closed') })
        this.win.on('ready-to-show', () => { console.log(id + ':', 'ready-to-show') })
        this.win.on('restore', () => { console.log(id + ':', 'restore') })
        this.win.on('session-end', () => { console.log(id + ':', 'session-end') })
    }

    Close() {
        this.win?.close()
    }
}
