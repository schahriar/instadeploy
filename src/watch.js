var fs = require('fs');
var path = require('path');
var chokidar = require('chokidar');

var watcher = function(directory, remote, callback) {
	/* Implement Minimatch Ignoring */
	// Initialize watcher
	chokidar.watch(directory, {
		ignored: /[\/\\]\./,
		persistent: true,
		depth: 100
	}).on('add', function(PATH) {
		callback(PATH, directory, remote);
	})
  	.on('change', function(PATH) {
		callback(PATH, directory, remote);
	})
}

module.exports = watcher;