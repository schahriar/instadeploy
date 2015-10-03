var fs = require('fs');
var path = require('path');
var async = require('async');

function asyncWalk(directoryPaths, fileCallback, directoryCallback, doneCallback) {
	var directoryPath, rootPath, execArray = [];
	if(Array.isArray(directoryPaths)) {
		rootPath = directoryPaths[0];
		directoryPath = directoryPaths[1];
	}else{
		rootPath = directoryPaths;
		directoryPath = directoryPaths;
	}
	fs.readdir(directoryPath, function(error, files) {
		if (error) return fileCallback(error);
		files.forEach(function(name) {
			execArray.push(function(callback) {
				var directPath = path.resolve(directoryPath, name);
				var relativePath = path.join(path.relative(rootPath, directoryPath), name);
				fs.stat(directPath, function(error, stats) {
					if (error) return fileCallback(error);
					if(stats.isFile()) {
						fileCallback(null, directPath, relativePath, stats);
						callback();
					}else{
						if(directoryCallback) directoryCallback(null, directPath, relativePath, function(ignore) {
							if(!ignore) asyncWalk([rootPath, directPath], fileCallback, directoryCallback, callback);
							else callback();
						})
						else asyncWalk([rootPath, directPath], fileCallback, directoryCallback, callback);
					}
				})
			})	
		})
		async.parallel(execArray, doneCallback || new Function);
	})
}

module.exports = asyncWalk;