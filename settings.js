const fs = require("fs");

function Get() {
  return JSON.parse(fs.readFileSync('./settings.json'))
}

module.exports = { Get }
