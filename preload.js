const { ipcRenderer, app } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  document.querySelector('#stack-content table').innerHTML = ''

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
    const content = document.querySelector('#output-content ul')

    const AddLine = function(line, className) {
      const newLi = document.createElement('li')
      newLi.className = className
  
      const newSpan = document.createElement('span')
      newSpan.textContent = line
      newLi.appendChild(newSpan)
  
      content.appendChild(newLi)
    }

    /** @type {{ Type: 'Debug'|'Error', Message: string }} */
    const log = args

    if (log.Message.trim().includes('\n')) {
      const lines = log.Message.trim().split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.trim().length === 0) { continue }
        AddLine(line, 'console-log-' + log.Type.toLowerCase())
      }
    } else {
      AddLine(log.Message, 'console-log-' + log.Type.toLowerCase())
    }
    
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
      StackMemorySize: number
      Stack: {
        Value: string | 'null'
        Type: 'INT'|'FLOAT'|'STRING'|'BOOLEAN'|'STRUCT'|'LIST'|'RUNTIME'
        Tag: string | null
      }[]
     }}
     */
    const Interpeter = data

    document.getElementById('stack-memory-used').innerText = Interpeter.StackMemorySize.toString()
    
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

    /** @type {HTMLTableElement} */
    const stackContent = document.querySelector('#stack-content table')
    stackContent.innerHTML = ''

    const headerRow = document.createElement('tr')
    headerRow.appendChild(document.createElement('th'))
    headerRow.appendChild(document.createElement('th'))
    stackContent.appendChild(headerRow)

    var lastReturnValueIcon = null

    var basePointerShown = false
    for (let i = 0; i < Interpeter.Stack.length; i++) {
      const item = Interpeter.Stack[i]
      const newRow = document.createElement('tr')

      const cell0 = document.createElement('td')
      const cell1 = document.createElement('td')

      if (Interpeter.BasePointer === i) {
        const newI = document.createElement('i')
        newI.className = 'fa-sharp fa-solid fa-caret-right st-base-pointer st-base-pointer-active'
        newI.title = 'Base Pointer'
        cell0.appendChild(newI)
        basePointerShown = true
      }

      cell0.appendChild(CreateSpan(i.toString(), ''))

      if (item.Type === 'INT' || item.Type === 'FLOAT') {
        cell1.appendChild(CreateSpan(item.Value, 'st-num'))
      } else if (item.Type === 'STRING') {
        cell1.appendChild(CreateSpan('"' + item.Value + '"', 'st-str'))
      } else if (item.Type === 'BOOLEAN') {
        cell1.appendChild(CreateSpan(item.Value, 'st-bool'))
      } else if (item.Type === 'STRUCT') {
        cell1.appendChild(CreateSpan('{ ... }', ''))
      } else if (item.Type === 'LIST') {
        cell1.appendChild(CreateSpan('[ ... ]', ''))
      } else {
        cell1.appendChild(CreateSpan(item.Value, 'st-param'))
      }

      if (item.Tag !== null) {
        if (item.Tag === 'return value' && i < Interpeter.BasePointer) {
          const newI = document.createElement('i')
          newI.className = 'fa-solid fa-share st-return-value'
          newI.title = 'Return Value'
          newI.style.transform = 'rotate(-90deg)'
          cell1.appendChild(newI)
          lastReturnValueIcon = newI
        } else if (item.Tag === 'saved base pointer') {
          const newI = document.createElement('i')
          newI.className = 'fa-sharp fa-solid fa-caret-right st-base-pointer'
          newI.title = 'Saved Base Pointer'
          try {
            stackContent.querySelectorAll('tr')[Number.parseInt(item.Value)+1].querySelector('td').appendChild(newI)
          } catch (err) { }
          cell1.appendChild(CreateSpan(item.Tag, 'st-tag'))
        } else {
          cell1.appendChild(CreateSpan(item.Tag, 'st-tag'))
        }
      }

      newRow.appendChild(cell0)
      newRow.appendChild(cell1)
    
      stackContent.appendChild(newRow)
    }

    if (lastReturnValueIcon) {
      lastReturnValueIcon.classList.add('st-return-value-active')
    }

    if (basePointerShown === false && Interpeter.BasePointer === Interpeter.Stack.length) {    
      const newRow = document.createElement('tr')

      const cell0 = document.createElement('td')
      const cell1 = document.createElement('td')

      const newI = document.createElement('i')
      newI.className = 'fa-sharp fa-solid fa-caret-right st-base-pointer st-base-pointer-active'
      newI.title = 'Base Pointer'
      cell0.appendChild(newI)
      basePointerShown = true

      newRow.appendChild(cell0)
      newRow.appendChild(cell1)
    
      stackContent.appendChild(newRow)    
    }
  })

  ipcRenderer.on('comp-res', (e, data) => {
    /**
     @type {{
      SetGlobalVariablesInstruction: number
      ClearGlobalVariablesInstruction: number
      CompiledCode: {
        Opcode: string
        Parameter: string | number | boolean | null
        ParameterIsComplicated: boolean
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

          /** @type {HTMLSpanElement | null} */
          var valueSpan = null

          if (typeof instruction.Parameter === 'number') {
            valueSpan = CreateSpan(instruction.Parameter, 'c-num')
          } else if (typeof instruction.Parameter === 'string') {
            if (instruction.ParameterIsComplicated) {
              valueSpan = CreateSpan(instruction.Parameter, '')
            } else {
              valueSpan = CreateSpan('"' + instruction.Parameter + '"', 'c-str')
            }
          } else if (typeof instruction.Parameter === 'boolean') {
            valueSpan = CreateSpan(instruction.Parameter, 'c-bool')
          } else {
            valueSpan = CreateSpan(instruction.Parameter, 'c-param')
          }
          
          if (instruction.ParameterIsComplicated) {
            valueSpan.classList.add('c-too-complicated')
            valueSpan.title = 'Too complicated value'
          }

          newSpan.appendChild(valueSpan)

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
    /** @param {string} line */
    const AddLine = function(line) {
      const newLi = document.createElement('li')
  
      const newSpan = document.createElement('span')
      newSpan.textContent = line
      if (line.startsWith('at ')) {
        newSpan.style.paddingLeft = '32px'
      }
      newLi.appendChild(newSpan)
  
      document.querySelector('#error-log-content ul').appendChild(newLi)
  
      const contentContainer = document.getElementById('error-log-content').parentElement
      contentContainer.scrollTo(0, contentContainer.scrollHeight)
    }

    if (typeof data === 'string') {
      if (data.trim().includes('\n')) {
        const lines = data.trim().split('\n')
        for (let i = 0; i < lines.length; i++) {
          AddLine(lines[i].trim())
        }
      } else {
        AddLine(data.trim())
      }
      return
    } else {
      AddLine(JSON.stringify(data, null, ' '))
    }
  })

  ipcRenderer.on('closed', (e, code) => {
    document.querySelector('#stack-content table').innerHTML = ''
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

  OnButtonClick('toolbar-dev-tools', () => {
    ipcRenderer.send('toolbar-dev-tools')
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


function GetDocumentTitle(baseID) {
  const base = document.getElementById(baseID)

  const a = base.parentElement.parentElement
  if (a.classList.contains('jqx-widget-content') && a.classList.contains('jqx-ribbon-content')) {
      return a.parentNode.children.item(0).children.item(0)
  }

  if (a.classList.contains('jqx-resize') && a.classList.contains('jqx-rc-all')) {
      return a.children.item(0).children.item(0)
  }

  return null
}
