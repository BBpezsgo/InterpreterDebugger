const Form = require('./form')

module.exports = class SetupForm extends Form {    
    CreateWindow() {
        const path = require('path')
        this.InitWindow('SetupForm', './forms/setup/index.html', {
            width: 500,
            height: 130,
            webPreferences: {
                preload: path.join(__dirname, 'forms/setup/preload.js')
            },
            resizable: false,
            icon: './icon.ico'
        })
    }
}
