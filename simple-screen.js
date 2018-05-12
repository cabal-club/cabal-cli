var strftime = require("strftime")
function Screen() {
    if (!(this instanceof Screen)) return new Screen()
}

// use to write user messages
Screen.prototype.writeMessage = function(msg) {
    console.log(`${formatTime(msg.value.time)} <${msg.value.author}> ${msg.value.text}`)
}

// use to write anything else to the screen, e.g. info messages or emotes 
Screen.prototype.writeLine = function(line) {
    console.log(line)
}

function formatTime(t) {
    return strftime("%T", new Date(t))
}
module.exports = Screen
