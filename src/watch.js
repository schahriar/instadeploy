var minimatch = require("minimatch");
var chokidar = require('chokidar');
var path = require('path');

function matchMaker(base, patterns) {
	// Inspired by https://github.com/joshwnj/minimatch-all/blob/master/index.js
	// Minimatch multiple patterns
	var doesMatch = false;
	patterns.forEach(function(pattern){
		doesMatch = ((doesMatch) && (pattern[0] !== '!'))?doesMatch:minimatch(base, pattern);
	});
	return doesMatch;
}

var watcher = function(directory, remote, ignorePatterns, callback, ignoredCallback) {
	/* Implement Minimatch Ignoring */
	// Initialize watcher
	chokidar.watch(directory, {
		ignored: function(PATH) {
			// Ignored function takes care of events & pattern recognition
			if(matchMaker(path.relative(directory, PATH), ignorePatterns)) {
				// Callback for event to be emitted
				ignoredCallback(PATH, path.relative(directory, PATH));
				return true;
			}
		},
		persistent: true // Keep Alive
	}).on('add', function(PATH) {
		callback(PATH, directory, remote);
	})
  	.on('change', function(PATH) {
		callback(PATH, directory, remote);
	})
}

module.exports = watcher;