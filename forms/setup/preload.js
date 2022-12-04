const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  /** @type {HTMLInputElement} */
  const input = document.getElementById('inp-exe')
  /** @type {HTMLButtonElement} */
  const button = document.getElementById('btn-ok')
  button.addEventListener('click', () => {
    ipcRenderer.send('on-setup', input.value)
  })
})
