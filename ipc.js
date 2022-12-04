const { spawn, ChildProcessWithoutNullStreams } = require('child_process')
const { EventEmitter } = require('node:events')
const settings = require('./settings').Get()

class IPC extends EventEmitter {
    constructor() {
        super()
        /** @type {ChildProcessWithoutNullStreams} */
        this.childProcess = null
        /** @type {{type:string;data:any}[]} */
        this.outMessages = []
        /** @type {boolean} */
        this.awaitAck = false
        /** @type {string} */
        this.rawInput = ''
    }

    /** @param {string | undefined} file @param {'DEBUG' | 'EDITOR'} type */
    Start(file, type) {
        const runFile = file || settings.testFiles + 'test6.bbc'

        if (type === 'EDITOR') {
            this.childProcess = spawn(settings.path, [ "-code-editor", runFile ])
        } else if (type === 'DEBUG') {
            this.childProcess = spawn(settings.path, [ "-debug", "-throw-errors", runFile ])
        }

        this.childProcess.on('close', (code, signal) => {
            console.log('Close:', code, signal)
            this.emit('closed', code)
        })

        this.childProcess.on('exit', (code, signal) => {
            console.log('Exit:', code, signal)
        })

        this.childProcess.on('error', (error) => {
            console.log('Error:', error)
        })

        this.childProcess.on('disconnect', () => {
            console.log('Disconnect')
        })

        this.childProcess.on('message', (message, sendHandle) => {
            console.log('Message:', message)
        })

        this.childProcess.on('spawn', () => {
            console.log('Spawn')
        })

        this.childProcess.stdin.setEncoding("utf8")

        this.childProcess.stderr.on('data', function (data) {
            console.log('< ', data.toString())
            self.emit('error-message', data.toString())
        })

        const self = this
        this.childProcess.stdout.on('data', function (payload) {
            self.rawInput += payload.toString()

            /** @param {string} line */
            const ParseLine = function(line) {
                if (line.trim().length === 0) { return }
                self.OnRecive(JSON.parse(line.trim()))
            }
            
            if (self.rawInput.includes('\n')) {
                var errorMessage = ''
                while (self.rawInput.includes('\n')) {
                    const firstLine = self.rawInput.split('\n')[0]
                    self.rawInput = self.rawInput.substring(firstLine.length + 1)
                    try {
                        ParseLine(firstLine)
                    } catch (error) {
                        console.log(error, '\nMessage: ', firstLine)
                        errorMessage += firstLine + '\n'
                    }
                }
                if (errorMessage !== '') {
                    self.emit('unknown-message', errorMessage)
                }
            } else {
                console.log('Wait end of message')
                return
            }

            try {
                ParseLine(self.rawInput)
                return
            } catch (error) {
                console.log(error, '\nMessage: ', self.rawInput)
            }

            self.emit('unknown-message', self.rawInput)
        })

        /** @type {{type:string;data:any}[]} */
        this.outMessages = []
        /** @type {boolean} */
        this.awaitAck = false
    }

    /** @param {{ type: string, data: any }} data */
    OnRecive(data) {
        console.log(`< ${data.type}`, data.data)
        if (data.type === 'ack') {
            this.awaitAck = false
            this.TrySendNext()
            return
        }
        this.SendACK()
        if (data.type === 'pong') {
            console.log('< Pong: ', data.data)
            return
        }
        this.emit('message', data)
    }

    SendACK() {
        console.log(`> ACK`)
        this.childProcess.stdin.write(JSON.stringify({ type: 'ack', data: '' }) + "\n")
    }

    TrySendNext() {
        if (this.awaitAck) { return }
        if (this.outMessages.length === 0) { return }
        if (this.childProcess.stdin.writable === false) { return }
        this.awaitAck = true
        setTimeout(() => {
            if (this.childProcess.stdin.writable === false) { this.awaitAck = false; return }
            const message = this.outMessages[0]
            try {
                this.childProcess.stdin.write(JSON.stringify(message) + "\n")
            } catch (error) {
                console.log(error)
                this.emit('error', error)
                return
            }
            this.outMessages.splice(0, 1)
            console.log(`> ${message.type}`, message.data)                
        }, 100)
    }

    /** @param {{ type: string, data: any }} message */
    Send(message) {
        this.outMessages.push(message)
        this.TrySendNext()
    }

    Stop() {
        this.childProcess.kill()
    }

    IsRunning() {
        if (this.childProcess === undefined) { return false }
        if (this.childProcess === null) { return false }
        if (this.childProcess.killed) { return false }
        if (this.childProcess.exitCode === null) { return true }
        else { return false }
    }
}

module.exports = { IPC }