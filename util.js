function logResult(err, result) {
    if (err) { console.error("hyperdb failed with", err) }
    if (arguments.length >= 2) { console.log(result) }
}

module.exports = {log: logResult}

