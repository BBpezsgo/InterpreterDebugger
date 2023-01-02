const { ipcRenderer, app, ipcMain } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  function GenerateIcon(iconName) {
    const newIcon = document.createElement('i')
    newIcon.className = iconName
    return newIcon
  }

  // SetupCodeEditor(document.getElementById('editing'))

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
        document.getElementById('status-label').innerText = 'Start Process ...'
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
    document.getElementById('stack-base-pointer-value').innerText = Interpeter.BasePointer
    
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
      newRow.id = 'stack-row-i-' + i

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
        } else if (item.Tag.startsWith('var.')) {
          const varName = item.Tag.substring(4)
          const newElement = document.createElement('span')
          const newIcon = GenerateCustomIcon('../../gui/var.png', '#f00', 16, 16)
          newIcon.style.display = 'inline-block'
          newElement.appendChild(newIcon)
          newElement.appendChild(CreateSpan(varName, ''))
          newElement.className = 'stack-label-var'
          newElement.title = 'Variable'
          cell1.appendChild(newElement)
        } else if (item.Tag.startsWith('param.') && i < Interpeter.BasePointer) {
          const varName = item.Tag.substring(6)
          const newElement = document.createElement('span')
          const newIcon = GenerateCustomIcon('../../gui/var.png', '#f00', 16, 16)
          newIcon.style.display = 'inline-block'
          newElement.appendChild(newIcon)
          newElement.appendChild(CreateSpan(varName, ''))
          newElement.className = 'stack-label-var'
          newElement.title = 'Parameter'
          cell1.appendChild(newElement)
        } else {
          cell1.appendChild(CreateSpan(item.Tag, 'st-tag'))
        }
      }

      newRow.appendChild(cell0)
      newRow.appendChild(cell1)

      if (document.getElementsByClassName('stack-higlighted-index-' + i).length > 0) {
        newRow.classList.add('stack-item-higlighted')
      }
    
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
        newItem.id = 'c-code-i-' + i

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

          if (instruction.Opcode === 'JUMP_BY_IF_FALSE' || instruction.Opcode === 'JUMP_BY_IF_TRUE' || instruction.Opcode === 'JUMP_BY' || instruction.Opcode === 'CALL') {
            if (typeof instruction.Parameter === 'number') {
              valueSpan.addEventListener('mouseenter', (e) => {
                document.getElementById('c-code-i-' + (instruction.Parameter + i)).classList.add('c-jump-to-target')
              })
              valueSpan.addEventListener('mouseleave', (e) => {
                document.getElementById('c-code-i-' + (instruction.Parameter + i)).classList.remove('c-jump-to-target')
              })
              valueSpan.addEventListener('click', (e) => {
                e.target.classList.add('c-jump-to-from-stay')
                document.getElementById('c-code-i-' + (instruction.Parameter + i)).classList.add('c-jump-to-target-stay')
                document.getElementById('c-code-i-' + (instruction.Parameter + i)).scrollIntoView({behavior: 'smooth'})
              })
              valueSpan.title = 'Scroll to target'
              valueSpan.classList.add('c-jump-to-from')
              
              const newIcon = document.createElement('i')
              if (instruction.Parameter > 0) {
                newIcon.className = 'fa-solid fa-turn-down'
              } else {
                newIcon.className = 'fa-solid fa-turn-up'
              }
              valueSpan.appendChild(newIcon)
            }
          }

          newSpan.appendChild(valueSpan)
          
          const GetStackInfo = function() {
            const basePointerValueElement = document.getElementById('stack-base-pointer-value')
            /** @type {HTMLTableElement} */
            const stackContentTable = document.querySelector('#stack-content>table')
            const basePointerValueText = basePointerValueElement.textContent

            const stackSize = stackContentTable.childElementCount - 1
            const basePointer = Number.parseInt(basePointerValueText)

            return {
              size: stackSize,
              basePointer: basePointer
            }
          }

          /** @param {number} itemIndex @param {HTMLElement} element */
          const HiglightStackItem = function(itemIndex, element) {
            element.setAttribute('stack-higlighted-index', itemIndex)
            element.classList.add('stack-higlighted-index-' + itemIndex)

            const stackItem = document.getElementById('stack-row-i-' + itemIndex)
            if (stackItem === null || stackItem === undefined) {
              element.classList.add('stack-higlighted-error')
              element.title = 'Stack element not exists'
            } else {
              stackItem.classList.add('stack-item-higlighted')
              element.classList.add('stack-higlighted')
              element.title = ''
            }
          }
          /** @param {HTMLElement} element */
          const NoHiglightStackItem = function(element) {
            if (element.hasAttribute('stack-higlighted-index') !== true) { return }
            const higlightedIndex = Number.parseInt(element.getAttribute('stack-higlighted-index'))
            element.classList.remove('stack-higlighted-index-' + higlightedIndex)

            const stackItem = document.getElementById('stack-row-i-' + higlightedIndex)
            if (stackItem === null || stackItem === undefined) {

            } else {
              stackItem.classList.remove('stack-item-higlighted')
            }
            element.classList.remove('stack-higlighted')
            element.classList.remove('stack-higlighted-error')
            element.title = ''
          }

          if (instruction.Opcode === 'LOAD_VALUE' || instruction.Opcode === 'STORE_VALUE') {
            newSpan.addEventListener('mouseenter', (e) => {
              HiglightStackItem(instruction.Parameter, newItem)
            })
            newSpan.addEventListener('mouseleave', (e) => {
              NoHiglightStackItem(newItem)
            })

            const newIcon = document.createElement('i')
            newIcon.className = 'fa-solid fa-database'
            newSpan.appendChild(newIcon)
          } else if (instruction.Opcode === 'LOAD_VALUE_BR' || instruction.Opcode === 'STORE_VALUE_BR') {
            newSpan.addEventListener('mouseenter', (e) => {
              const stack = GetStackInfo()
              HiglightStackItem(instruction.Parameter + stack.basePointer, newItem)
            })
            newSpan.addEventListener('mouseleave', (e) => {
              NoHiglightStackItem(newItem)
            })
            
            const newIcon = document.createElement('i')
            newIcon.className = 'fa-solid fa-database'
            newSpan.appendChild(newIcon)
          } else if (instruction.Opcode === 'LOAD_VALUE_R' || instruction.Opcode === 'STORE_VALUE_R') {
            newSpan.addEventListener('mouseenter', (e) => {
              const stack = GetStackInfo()
              HiglightStackItem(instruction.Parameter + stack.size, newItem)
            })
            newSpan.addEventListener('mouseleave', (e) => {
              NoHiglightStackItem(newItem)
            })
            
            const newIcon = document.createElement('i')
            newIcon.className = 'fa-solid fa-database'
            newSpan.appendChild(newIcon)
          }

          if (instruction.AdditionParameter !== '' && instruction.AdditionParameter !== null) {
            newSpan.appendChild(CreateSpan('"' + instruction.AdditionParameter + '"', 'c-str'))
          }

          if (instruction.AdditionParameter2 !== -1 && instruction.AdditionParameter !== null) {
            newSpan.appendChild(CreateSpan(instruction.AdditionParameter, 'c-num'))
          }
        }

        if (instruction.Tag !== '' && instruction.Tag !== null) {
          newSpan.appendChild(CreateSpan(instruction.Tag, 'c-label-tag'))
        }

        document.body.addEventListener('mouseup', (e) => {
          const list0 = document.getElementsByClassName('c-jump-to-target-stay')
          const list1 = document.getElementsByClassName('c-jump-to-target')
          const list2 = document.getElementsByClassName('c-jump-to-from-stay')
          for (let i = 0; i < list0.length; i++)
          { list0[i].classList.remove('c-jump-to-target-stay') }
          for (let i = 0; i < list1.length; i++)
          { list1[i].classList.remove('c-jump-to-target') }
          for (let i = 0; i < list2.length; i++)
          { list2[i].classList.remove('c-jump-to-from-stay') }
        }, true); 
        
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

    console.log(data)

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
    document.getElementById('status-label').innerText = 'Start Process ...'
    DisableButton('start-debug')
    ipcRenderer.send('start-debug')    
  })
  
  OnButtonClick('stop-debug', () => {
    document.getElementById('status-label').innerText = 'Stop Process ...'
    DisableButton('debug-step')
    DisableButton('stop-debug')
    ipcRenderer.send('stop-debug')    
  })
  
  OnButtonClick('debug-step', () => {
    document.getElementById('status-label').innerText = 'Execute Next Instruction ...'
    DisableButton('debug-step')
    DisableButton('stop-debug')
    ipcRenderer.send('debug-step')
  })

  OnButtonClick('toolbar-dev-tools', () => {
    ipcRenderer.send('toolbar-dev-tools')
  })
  
  document.getElementById('status-label').innerText = 'Ready'

  ipcRenderer.on('editor-tokens', (e, result) => {
    /**
    @type {{
      Text: string
      Type: string
      Subtype: string
      Start: number
      End: number
      Col: number
      Line: number
    }[]}
    */
    const tokens = result['Tokens']
    /**
    @type {{
      Message: string
      Start: number
      End: number
    } | null}
    */
    const error = result['Error']

    var result = ''

    var currentCol = 0
    var currentLine = 1

    /** @param {string} text */
    const ParseText = function(text) {
      return text
        .replace(new RegExp("&", "g"), "&amp;")
        .replace(new RegExp("<", "g"), "&lt;")
        .replace(new RegExp(">", "g"), "&mt;")
        .replace(new RegExp(" ", "g"), "&nbsp;")
        .replace(new RegExp("\t", "g"), "&nbsp;&nbsp;")
        .replace(new RegExp("\n", "g"), "<br>")
    }

    /** @param {number} to */
    const AddSpaces = function(to) {
      while (currentCol < to) {
        result += '&nbsp;'
        currentCol++
      }
    }

    /** @param {number} to */
    const AddLines = function(to) {
      while (currentLine < to) {
        result += '<br>'
        currentLine++
      }
    }

    /** @param {string} text */
    const AddText = function(text) {
      currentCol += text.length
      result += ParseText(text)
    }

    /** @param {string} text */
    const AddLabel = function(text, className) {
      currentCol += text.length
      result += `<span class="t-${className}">${ParseText(text)}</span>`
    }

    var errorStartPlaced = false
    var errorEndPlaced = false
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      if (error !== null) {
        if (errorStartPlaced === false) {
          if (token.Start >= error.Start) {
            result += `<span class="t-error">`
            errorStartPlaced = true
          }
        } else if (errorEndPlaced === false) {
          if (token.Start > error.End) {
            result += '</span>'
            errorEndPlaced = true
          }
        }
      }

      if (token.Type === 'WHITESPACE') {
        AddText(token.Text)
      } else if (token.Type === 'LINEBREAK') {
        AddText('\n')
      } else if (token.Type === 'LITERAL_NUMBER') {
        AddLabel(token.Text, 'number')
      } else if (token.Type === 'LITERAL_FLOAT') {
        AddLabel(token.Text, 'number')
      } else if (token.Type === 'LITERAL_STRING') {
        AddLabel(`"${token.Text}"`, 'string')
      } else if (token.Type === 'IDENTIFIER') {
        if (token.Subtype === 'Keyword') {
          AddLabel(token.Text, 'keyword')
        } else if (token.Subtype === 'VariableName') {
          AddLabel(token.Text, 'var')
        } else if (token.Subtype === 'MethodName') {
          AddLabel(token.Text, 'function')
        } else if (token.Subtype === 'Type') {
          AddLabel(token.Text, 'class')
        } else if (token.Subtype === 'Struct') {
          AddLabel(token.Text, 'struct')
        } else if (token.Subtype === 'Statement') {
          AddLabel(token.Text, 'statement')
        } else if (token.Subtype === 'Library') {
          AddLabel(token.Text)
        } else {
          AddText(token.Text)
        }
      } else {
        AddText(token.Text)
      }
    }

    if (errorStartPlaced === true && errorEndPlaced === false) {
      result += '</span>'
    }
    
    const resultElement = document.querySelector("#highlighting-content")
    resultElement.innerHTML = result
  })
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

/** @param {string} iconPath @param {string} color @param {number} width @param {number} height */
function GenerateCustomIcon(iconPath, color, width, height) {
  const base = document.createElement('div')
  base.style.webkitMaskImage = 'url("' + iconPath + '")'
  base.style.webkitMaskRepeat = 'no-repeat'
  base.style.webkitMaskSize = 'contain'

  const child = document.createElement('div')
  child.style.width = width + 'px'
  child.style.height = height + 'px'
  child.style.backgroundColor = color

  base.appendChild(child)

  return base
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

/** @param {HTMLTextAreaElement} element */
function SetupCodeEditor(element) {
  element.addEventListener('input', (e) => {
    CodeEditorUpdate(element.value)
    CodeEditorSyncScroll(element)
  })
  element.addEventListener('scroll', (e) => {
    CodeEditorSyncScroll(element)
  })
  element.addEventListener('wheel', (e) => {
    CodeEditorSyncScroll(element)
  })
  element.addEventListener('keydown', (e) => {
    CodeEditorCheckTab(element, e)
  })
}

/** @param {string} text */
function CodeEditorUpdate(text) {  
  ipcRenderer.send('editor-text', text)
}

/** @param {HTMLTextAreaElement} element */
function CodeEditorSyncScroll(element) {
  const resultElement = document.querySelector("#highlighting")
  resultElement.scrollTop = element.scrollTop
  resultElement.scrollLeft = element.scrollLeft
}

/** @param {HTMLTextAreaElement} element @param {KeyboardEvent} event */
function CodeEditorCheckTab(element, event) {
  let code = element.value;
  if (event.key === "Tab") {
    event.preventDefault()
    let beforeTab = code.slice(0, element.selectionStart)
    let afterTab = code.slice(element.selectionEnd, element.value.length)
    let cursorPos = element.selectionStart + 2
    element.value = beforeTab + "  " + afterTab
    element.selectionStart = cursorPos
    element.selectionEnd = cursorPos
    CodeEditorUpdate(element.value)
  }
}
