var eventEmmiter = require('events').EventEmitter;
var util = require('util');
var path = require('path');
var walker = require('./src/walk.js');
var Watcher = require('./src/watch.js');
var ConnectionManager = require('./src/connectionManager.js');
var minimatch = require("minimatch");
var async = require('async');
var uniq = require('lodash.uniq');
var crypto = require('crypto');

// http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
function randomValueHex(len) {
    return crypto.randomBytes(Math.ceil(len/2))
        .toString('hex') // convert to hexadecimal format
        .slice(0,len);   // return required number of characters
}

function matchMaker(base, patterns) {
	// Inspired by https://github.com/joshwnj/minimatch-all/blob/master/index.js
	var doesMatch = false;
	patterns.forEach(function(pattern){
		doesMatch = ((doesMatch) && (pattern[0] !== '!'))?doesMatch:minimatch(base, pattern);
	});
	return doesMatch;
}

var InstaDeploy = function (remoteArray, options) {
	var context = this;

	/*
		OPTIONS
		▬▬▬▬▬▬▬
		maxConcurrentConnections:   <Number> 5,
		maxConcurrentFiles:         <Number> 10,
		queueTime:                  <Time:MS> 1500,
		ignoreFolders:              <Array> ['.git', 'node_modules'],
		ignoreFiles:                <Array> ['.gitignore']
	
	*/
	context.options = options || {};
	context.clientInstances = {};
	// Smart Queue Prevents multiple uploads of the same file
	// by removing duplicates within a time frame
	context.smartQueueList = [];
	context.smartQueueTimeFrame;
	
	context.smartQueueFlush = function() {
		// Remove Duplicates (reverse to select from the end)
		uniq(context.smartQueueList.reverse(), 'remotePath').forEach(function(item) {
			context.queue.push(item, item.callback);
			context.emit('uploadStarted', item);
		})
		// Reset SmartQueue
		context.smartQueueList = [];
	}
	
	// Push New instances of scp2 for every remote server provided
	if(remoteArray) remoteArray.forEach(function(remote) {
		if(!remote.name) remote.name = randomValueHex(8);
		context.clientInstances[remote.name] = new ConnectionManager(remote);
		context.clientInstances[remote.name].on('attempting', function(remote, manager) {
			context.emit('attempt', remote, manager.retries);
		})
		context.clientInstances[remote.name].on('connected', function(remote, manager) {
			context.emit('connect', remote, manager.retries, manager.connection);
		})
		context.clientInstances[remote.name].on('disconnected', function(remote, manager) {
			context.emit('disconnect', remote, manager.retries, manager.error, manager.failed)
		})
		context.clientInstances[remote.name].connect(true);
	})
	// Create an Async queue for uploads
	context.queue = async.queue(function (file, callback) {
		var parallelExecutionArray = [];
		for(var name in context.clientInstances) { 
			parallelExecutionArray.push(function(_callback){
				if(context.clientInstances[name].connection) context.clientInstances[name].connection.upload(file.localPath, file.remotePath, _callback);
				else _callback(new Error("Connection instance not found!"));
			});
		}
		if(parallelExecutionArray.length <= 0) callback(new Error("No Connections found!"));
		else async.parallelLimit(parallelExecutionArray, context.options.maxConcurrentConnections || 5, callback);
	}, context.options.maxConcurrentFiles || 10);
	
	eventEmmiter.call(this);
}

util.inherits(InstaDeploy, eventEmmiter);

/*
if(!matchMaker(relativePath, context.options.ignoreFiles || ['.gitignore'])) {
			watcher.watch({ direct: directPath, directory: directoryPath, relative: relativePath, remote: remotePath }, function FILE_ON_UPLOAD(error) {
				if(!error) context.emit('uploaded', directoryPath, path.join(remotePath, relativePath));
				else context.emit('failed', error, directoryPath, path.join(remotePath, relativePath));
			});
		}else{
			context.emit('ignored', 'file', directPath, relativePath, context.options.ignoreFiles);
		}
*/

InstaDeploy.prototype.watch = function(directoryPath, remotePath) {
	var context = this;
	var watcher = new Watcher(matchMaker, context.options.ignoreFiles || ['.gitignore'], context.smartQueueList, context.smartQueueTimeFrame, context.smartQueueFlush, context.options.queueTime || 1500);
	walker(directoryPath, function WALKER_ON_DIRECTORY(error, directPath, relativePath, callback) {
		// DIRECTORY FUNCTION
		// IF NO MATCH INCLUDE FOLDER
		/* ADD DIRECTORY WATCH FOR NEW FILES */
		if(!matchMaker(relativePath, context.options.ignoreFolders || ['.git', 'node_modules'])) {
			watcher.watch({ direct: directPath, directory: directoryPath, relative: relativePath, remote: remotePath }, true, function FILE_ON_NEW_UPLOAD(error) {
				if(!error) context.emit('uploaded', directoryPath, path.join(remotePath, relativePath));
				else context.emit('failed', error, directoryPath, path.join(remotePath, relativePath));
			});
			callback();
		}else{
			context.emit('ignored', 'folder', directPath, relativePath, context.options.ignoreFolders);
		}
	}, function WALKER_DONE() {
		// READY FUNCTION
		context.emit('watching', directoryPath, remotePath);
	})
}

module.exports = InstaDeploy;