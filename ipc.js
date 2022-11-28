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
    }

    /** @param {string | undefined} file */
    Start(file) {
        const runFile = file || settings.testFiles + 'test5.bbc'

        this.childProcess = spawn(settings.path, [ runFile ])

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
            const payloadText = (payload.toString() + '').trim()

            if (payloadText.includes('\n')) {
                const payloads = payloadText.split('\n')
                var errorAtElement = null
                try {
                    payloads.forEach(element => {
                        errorAtElement = element.trim()
                        /** @type {{type:string,data:any}} */
                        const payloadObj = JSON.parse(element.trim())

                        self.OnRecive(payloadObj)
                    })
                    return
                } catch (error) {
                    console.log(error, errorAtElement)
                }
            }

            try {
                /** @type {{type:string,data:any}} */
                const payloadObj = JSON.parse(payloadText)

                self.OnRecive(payloadObj)
                return
            } catch (error) {
                console.log(error, payloadText)
            }

            self.emit('unknown-message', payloadText)
            console.log('< [U] ', payloadText)
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