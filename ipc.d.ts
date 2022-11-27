import { EventEmitter } from 'node:events';

export type Message = {
    type: string,
    data: any,
}

type Listener<T> = (arg: T) => void

export class IPC extends EventEmitter {
    Send(message: Message): void
    Start(): void
    Stop(): void
    
    on(event: 'message', listener: Listener<Message>): this
    on(event: 'unknown-message', listener: Listener<string>): this
    on(event: 'error-message', listener: Listener<any>): this
    on(event: 'closed', listener: Listener<number>): this
    on(event: 'error', listener: Listener<any>): this
}
