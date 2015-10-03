var minimatch = require("minimatch");
var chokidar = require('chokidar');
var path = require('path');

function multiReg (patterns) {
	var expressions = [];
	patterns.forEach(function(pattern) {
		expressions = minimatch.makeRe(pattern);
	})
	return expressions;
}

function matchMaker(base, patterns) {
	// Inspired by https://github.com/joshwnj/minimatch-all/blob/master/index.js
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
			if(matchMaker(path.relative(directory, PATH), ignorePatterns)) {
				ignoredCallback(PATH, path.relative(directory, PATH));
				return true;
			}
		},
		persistent: true
	}).on('add', function(PATH) {
		callback(PATH, directory, remote);
	})
  	.on('change', function(PATH) {
		callback(PATH, directory, remote);
	})
}

module.exports = watcher;