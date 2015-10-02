var fs = require('fs');
var path = require('path');
var async = require('async');

function asyncWalk(directoryPaths, directoryCallback, doneCallback) {
	var directoryPath, rootPath, execArray = [], isRoot = false;
	if(Array.isArray(directoryPaths)) {
		rootPath = directoryPaths[0];
		directoryPath = directoryPaths[1];
	}else{
		rootPath = directoryPaths;
		directoryPath = directoryPaths;
		isRoot = true;
	}
	if(isRoot) {
		return directoryCallback(null, directoryPath, './', function(ignore){
			if(!ignore) asyncWalk([rootPath, directoryPath], directoryCallback, doneCallback);
		});
	}
	fs.readdir(directoryPath, function(error, folders) {
		if (error) return directoryCallback(error);
		folders.forEach(function(name) {
			execArray.push(function(callback) {
				var directPath = path.resolve(directoryPath, name);
				var relativePath = path.join(path.relative(rootPath, directoryPath), name);
				fs.stat(directPath, function(error, stats) {
					if (error) return directoryCallback(error);
					if(!stats.isFile()) {
						directoryCallback(null, directPath, relativePath, function(ignore) {
							if(!ignore) asyncWalk([rootPath, directPath], directoryCallback, callback);
							else callback();
						})
					}
				})
			})	
		})
		async.parallel(execArray, doneCallback);
	})
}

module.exports = asyncWalk;