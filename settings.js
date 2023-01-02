const fs = require("fs");

function Get() {
  return JSON.parse(fs.readFileSync('./settings.json', 'utf-8'))
}

module.exports = { Get }
