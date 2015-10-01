var fs = require('fs');
var path = require('path');

function watch(filePath, listener) {
	fs.watch(path.normalize(filePath), { persistent: true, recursive: false }, listener);
}

module.exports = watch;