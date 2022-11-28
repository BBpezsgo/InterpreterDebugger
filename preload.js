const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }

  ipcRenderer.on('files', (e, args) => {
    /** @type {string[]} */
    const files = args
    /** @type {HTMLUListElement} */
    const content = document.querySelector('#files-content>ul')
    content.innerHTML = ''
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      const newLi = document.createElement('li')
      newLi.addEventListener('click', (e) => {
        document.getElementById('status-label').innerText = 'Start Process...'
        DisableButton('start-debug')
        ipcRenderer.send('run-file', file)
      })
    
      const newI = document.createElement('i')

      const extension = file.includes('.') ? file.split('.')[file.split('.').length-1] : ''
      
      switch (extension) {
        case 'bbc':
          newI.className = 'fa-sharp fa-solid fa-file-code'
          break
      
        default:
          newI.className = 'fa-sharp fa-solid fa-file'
          break
      }

      newLi.appendChild(newI)

      newLi.appendChild(CreateSpan(file, 'se-file'))
  
      content.appendChild(newLi)
    }
  })

  ipcRenderer.on('con-out', (e, args) => {
    /** @type {{ Type: 'Debug'|'Error', Message: string }} */
    const log = args

    const newLi = document.createElement('li')
    newLi.className = 'console-log-' + log.Type.toLowerCase()

    if (log.Type !== 'Debug') {
      const newIcon = document.createElement('i')
      if (log.Type === 'Error') {
        newIcon.className = 'fa-solid fa-circle-exclamation'
      }
      newLi.appendChild(newIcon)
    }

    const newSpan = document.createElement('span')
    newSpan.textContent = log.Message
    newLi.appendChild(newSpan)

    const contentContainer = document.getElementById('output-content')
    const content = document.querySelector('#output-content ul')

    content.appendChild(newLi)

    contentContainer.parentElement.scrollTo(0, contentContainer.parentElement.scrollHeight)
  })

  ipcRenderer.on('intp2-data', (e, data) => {
    /**
     @type {{
      State: 'Initialized'|'Destroyed'|'SetGlobalVariables'|'CallCodeEntry'|'CallUpdate'|'CallCodeEnd'|'DisposeGlobalVariables'|'CodeExecuted'
     }}
     */
    const Interpeter = data

    switch (Interpeter.State) {
      case 'CallCodeEnd':
        document.getElementById('status-label').innerText = 'Interpeter State: Call "Code End"'
        break
      case 'CallCodeEntry':
        document.getElementById('status-label').innerText = 'Interpeter State: Call "Code Entry"'
        break
      case 'CallUpdate':
        document.getElementById('status-label').innerText = 'Interpeter State: Call "Update"'
        break
      case 'CodeExecuted':
        document.getElementById('status-label').innerText = 'Interpeter: Code Executed'
        break
      case 'Destroyed':
        document.getElementById('status-label').innerText = 'Interpeter Destroyed'
        break
      case 'DisposeGlobalVariables':
        document.getElementById('status-label').innerText = 'Interpeter State: Dispose Global Variables'
        break
      case 'Initialized':
        document.getElementById('status-label').innerText = 'Interpeter: Initialized'
        break
      case 'SetGlobalVariables':
        document.getElementById('status-label').innerText = 'Interpeter State: Set Global Variables'
        break
      default:
        document.getElementById('status-label').innerText = 'Interpeter: ' + Interpeter.State
        break
    }

    EnableButton('stop-debug')
    if (Interpeter.State !== 'CodeExecuted') {
      EnableButton('debug-step')
    }
  })

  ipcRenderer.on('intp-data', (e, data) => {
    /**
     @type {{
      BasePointer: number
      CodePointer: number
      Stack: {
        Value: string
        Type: 'INT'|'FLOAT'|'STRING'|'BOOLEAN'|'STRUCT'|'LIST'|'RUNTIME'
        Tag: string | null
      }[]
     }}
     */
    const Interpeter = data
    
    const eContentCode = document.querySelector('#code-content ul')

    const codeChildCount = eContentCode.childElementCount 
    var offset = 0
    var thisIsCurrent = false
    for (let i = 0; i < codeChildCount; i++) {
      const codeLine = eContentCode.children.item(i)
      if (!codeLine.classList.contains('c-code')) {
        offset--
        continue
      }

      codeLine.classList.remove('current')

      if (Interpeter.CodePointer === i + offset) {
        thisIsCurrent = true
      }

      if (thisIsCurrent === true && codeLine.childNodes.item(1).childNodes.item(0).className !== 'c-comment') {
        thisIsCurrent = false
        codeLine.classList.add('current')
      }
    }

    const stackContent = document.querySelector('#stack-content ul')
    stackContent.innerHTML = ''
    for (let i = 0; i < Interpeter.Stack.length; i++) {
      const item = Interpeter.Stack[i]
      const newItem = document.createElement('li')

      const lineNumber = CreateSpan(i.toString(), 'st-line-number')
      newItem.appendChild(lineNumber)

      if (item.Type === 'INT' || item.Type === 'FLOAT') {
        newItem.appendChild(CreateSpan(item.Value, 'st-num'))
      } else if (item.Type === 'STRING') {
        newItem.appendChild(CreateSpan('"' + item.Value + '"', 'st-str'))
      } else if (item.Type === 'BOOLEAN') {
        newItem.appendChild(CreateSpan(item.Value, 'st-bool'))
      } else if (item.Type === 'STRUCT') {
        newItem.appendChild(CreateSpan('{ ... }', ''))
      } else if (item.Type === 'LIST') {
        newItem.appendChild(CreateSpan('{ ... }', ''))
      } else {
        newItem.appendChild(CreateSpan(item.Value, 'st-param'))
      }

      if (item.Tag !== null) {
        newItem.appendChild(CreateSpan(item.Tag, 'st-tag'))
      }
    
      stackContent.appendChild(newItem)
    }
  })

  ipcRenderer.on('comp-res', (e, data) => {
    /**
     @type {{
      SetGlobalVariablesInstruction: number
      ClearGlobalVariablesInstruction: number
      CompiledCode: {
        Opcode: string
        Parameter: string | number | null
        Tag: string
        AdditionParameter: string
        AdditionParameter2: number
      }[]
     }}
     */
    const CompilerResult = data
    const eContentCode = document.querySelector('#code-content ul')
    eContentCode.innerHTML = ''
    var indent = 0
    for (let i = 0; i < CompilerResult.CompiledCode.length; i++) {
      if (CompilerResult.ClearGlobalVariablesInstruction === i)
      {
        const newItem = document.createElement('li')
        newItem.appendChild(CreateSpan('ClearGlobalVariables:', 'c-label'))
        eContentCode.appendChild(newItem)
      }

      if (CompilerResult.SetGlobalVariablesInstruction === i)
      {
        const newItem = document.createElement('li')
        newItem.appendChild(CreateSpan('SetGlobalVariables:', 'c-label'))
        eContentCode.appendChild(newItem)
      }

      {
        const instruction = CompilerResult.CompiledCode[i]
        const newItem = document.createElement('li')
        newItem.classList.add('c-code')

        const lineNumber = CreateSpan(i.toString(), 'c-line-number')
        newItem.appendChild(lineNumber)

        const newSpan = CreateSpan('', '')

        if (instruction.Opcode === 'COMMENT') {
          if (instruction.Parameter.toString().endsWith('}') && !instruction.Parameter.toString().endsWith('{ }')) {
            indent--
          }
          newSpan.style.paddingLeft = (indent * 8) + 'px'
          newSpan.appendChild(CreateSpan(instruction.Parameter, 'c-comment'))
          if (instruction.Parameter.endsWith('{')) {
            indent++
          }
        } else {
          newSpan.style.paddingLeft = (indent * 8 + 2) + 'px'
          newSpan.appendChild(CreateSpan(instruction.Opcode, 'c-opcode'))

          if (typeof instruction.Parameter === 'number') {
            newSpan.appendChild(CreateSpan(instruction.Parameter, 'c-num'))
          } else if (typeof instruction.Parameter === 'string') {
            newSpan.appendChild(CreateSpan('"' + instruction.Parameter + '"', 'c-str'))
          } else if (typeof instruction.Parameter === 'boolean') {
            newSpan.appendChild(CreateSpan(instruction.Parameter, 'c-bool'))
          } else {
            newSpan.appendChild(CreateSpan(instruction.Parameter, 'c-param'))
          }

          if (instruction.AdditionParameter !== '' && instruction.AdditionParameter !== null) {
            newSpan.appendChild(CreateSpan('"' + instruction.AdditionParameter + '"', 'c-str'))
          }

          if (instruction.AdditionParameter2 !== -1 && instruction.AdditionParameter !== null) {
            newSpan.appendChild(CreateSpan(instruction.AdditionParameter, 'c-num'))
          }
        }
        
        newItem.appendChild(newSpan)
        eContentCode.appendChild(newItem)
      }
    }
  })

  ipcRenderer.on('started', (e, data) => {
    EnableButton('stop-debug')
    document.getElementById('status-label').innerText = 'Process Started'
  })

  ipcRenderer.on('unknown-message', (e, data) => {
    const AddLine = function(line) {
      const newLi = document.createElement('li')
  
      const newSpan = document.createElement('span')
      newSpan.textContent = line
      newLi.appendChild(newSpan)
  
      document.querySelector('#error-log-content ul').appendChild(newLi)
  
      const contentContainer = document.getElementById('error-log-content')
      contentContainer.parentElement.scrollTo(0, contentContainer.parentElement.scrollHeight)
    }

    if (typeof data === 'string') {
      if (data.trim().split().includes('\n')) {
        const lines = data.trim().split()
      } else {
        AddLine(data)
      }
      return
    } else {
      AddLine(JSON.stringify(data, null, ' '))
    }
  })

  ipcRenderer.on('closed', (e, code) => {
    document.querySelector('#stack-content ul').innerHTML = ''
    document.querySelector('#code-content ul').innerHTML = ''

    DisableButton('stop-debug')
    DisableButton('debug-step')
    EnableButton('start-debug')
    
    document.getElementById('status-label').innerText = 'Process Closed with Exit Code ' + code
  })

  ipcRenderer.send('on-loaded')
  ipcRenderer.send('get-files')
  
  OnButtonClick('start-debug', () => {
    document.getElementById('status-label').innerText = 'Start Process...'
    DisableButton('start-debug')
    ipcRenderer.send('start-debug')    
  })
  
  OnButtonClick('stop-debug', () => {
    document.getElementById('status-label').innerText = 'Stop Process...'
    DisableButton('debug-step')
    DisableButton('stop-debug')
    ipcRenderer.send('stop-debug')    
  })
  
  OnButtonClick('debug-step', () => {
    document.getElementById('status-label').innerText = 'Execute Next Instruction...'
    DisableButton('debug-step')
    DisableButton('stop-debug')
    ipcRenderer.send('debug-step')
  })
  
  document.getElementById('status-label').innerText = 'Ready'
})

/** @param {(this: HTMLElement, ev: MouseEvent)=>void} callback */
const OnButtonClick = function(id, callback) {
  document.getElementById(id).addEventListener('click', callback)
}

const CreateSpan = function(content, className) {
  const eNew = document.createElement('span')
  eNew.textContent = content
  eNew.className = className
  return eNew
}

const DisableButton = function(id) {
  document.getElementById(id).classList.add('btn-disabled')
}
const EnableButton = function(id) {
  document.getElementById(id).classList.remove('btn-disabled')
}
