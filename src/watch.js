var fs = require('fs');
var path = require('path');

function watcher(matchMaker, ignoreList, queueList, queueTimeout, queueFlush, queueMaxTime) {
	this.list = {};
	/* Fix this mess */
	this.queueList = queueList;
	this.queueTimeout = queueTimeout;
	this.queueFlush = queueFlush;
	this.queueMaxTime = queueMaxTime;
	this.ignoreList = ignoreList;
	this.matchMaker = matchMaker;
}

watcher.prototype._watchFile = function(_Path_, callback) {
	var context = this;
	// Watch File
	return this.list[_Path_.direct] = function() {
		fs.stat(_Path_.direct, function(error, stats) {
			if(error) return console.log(error);
			if(stats.isFile()) {
				// Ignore unwanted files
				if(!context.matchMaker(_Path_.relative, context.ignoreList)) {
					context.queue(_Path_, callback);
				}/* Throw ignore event here */
			}
		})
	}
}

watcher.prototype._watchDirectory = function(_Path_, callback) {
	var context = this;
	// Watch Directory
	return function(event, filename) {
		// If file is not new then call the listed Queue Worker
		// Otherwise create a new watch for file
		if (context.list[_Path_.direct]) context.list[_Path_.direct]();
		else {
			_Path_.direct = path.join(_Path_.direct, filename);;
			_Path_.relative = path.join(_Path_.relative, filename);
			context.watch(_Path_, callback);
		}
	}
}

watcher.prototype.watch = function(_Path_, isDirectory, callback) {
	if (isDirectory === undefined) return;
	if (isDirectory.constructor === Function) {
		callback = isDirectory;
		isDirectory = false;
	}
	// If we are already watching the file return
	if (!!this.list[_Path_.direct]) return false;
	
	if (isDirectory) {
		// Watch Directory
		fs.watch(path.normalize(_Path_.direct), { persistent: true, recursive: true }, this._watchDirectory(_Path_, callback));
	}else{
		fs.watch(path.normalize(_Path_.direct), { persistent: true, recursive: false }, this._watchFile(_Path_, callback));
	}
}

watcher.prototype.queue = function(_Path_, callback) {
	var context = this;
	
	clearTimeout(this.queueTimeout);
	this.queueTimeout = setTimeout(function(){
		context.queueFlush();
	}, this.queueMaxTime);
	/* Implement a rename function */
	this.queueList.push({ localPath: _Path_.direct, remotePath: path.join(_Path_.remote, _Path_.relative), callback: callback});
}

module.exports = watcher;