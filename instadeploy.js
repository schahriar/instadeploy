var eventEmmiter = require('events').EventEmitter;
var util = require('util');
var path = require('path');
var Watcher = require('./src/watch.js');
var ConnectionManager = require('./src/connectionManager.js');
var async = require('async');
var uniq = require('lodash.uniq');
var crypto = require('crypto');

// http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
function randomValueHex(len) {
    return crypto.randomBytes(Math.ceil(len/2))
        .toString('hex') // convert to hexadecimal format
        .slice(0,len);   // return required number of characters
}

var InstaDeploy = function (remoteArray, options) {
	var context = this;

	/*
		OPTIONS
		▬▬▬▬▬▬▬
		maxConcurrentConnections:   <Number> 5,
		maxConcurrentFiles:         <Number> 10,
		queueTime:                  <Time:MS> 1500,
		ignore:                     <Array> ['.git', 'node_modules']
	
	*/
	context.options = options || {};
	context.clientInstances = {};
	// Smart Queue Prevents multiple uploads of the same file
	// by removing duplicates within a time frame
	context.smartQueueList = [];
	// Queue Timeout
	context.smartQueueTimeFrame;
	
	context.smartQueueFlush = function() {
		// Remove Duplicates (reverse to select from the end)
		uniq(context.smartQueueList.reverse(), 'remotePath').forEach(function(item) {
			// Push From TimedQueue to Async Queue
			context.queue.push(item, item.callback);
			// Emit an uploadStarted event
			context.emit('uploadStarted', item);
		})
		// Reset SmartQueue
		context.smartQueueList = [];
	}
	
	// Push New instances of scp2 for every remote server provided
	if(remoteArray) remoteArray.forEach(function(remote) {
		// Since remote.name is requried as a reference we'll generate one if it's not provided
		if(!remote.name) remote.name = randomValueHex(8);
		// Create a new ManagedConnection and assign it to the instance
		context.clientInstances[remote.name] = new ConnectionManager(remote);
		/// Connection related Events
		context.clientInstances[remote.name].on('attempting', function(remote, manager) {
			context.emit('attempt', remote, manager.retries);
		})
		context.clientInstances[remote.name].on('connected', function(remote, manager) {
			context.emit('connect', remote, manager.retries, manager.connection);
		})
		context.clientInstances[remote.name].on('disconnected', function(remote, manager) {
			context.emit('disconnect', remote, manager.retries, manager.error, manager.failed)
		})
		///
		// Start the connection
		context.clientInstances[remote.name].connect(true);
	})
	// Create an Async queue for uploads
	context.queue = async.queue(function (file, callback) {
		// Array for storing Parallel functions
		var parallelExecutionArray = [];
		// For every remote instance (aka Connection) available
		for(var name in context.clientInstances) { 
			// Push a new function to Async Parallel Array
			parallelExecutionArray.push(function(_callback){
				// If a connection is available upload file otherwise throw
				if(context.clientInstances[name].connection) context.clientInstances[name].connection.upload(file.localPath, file.remotePath, _callback);
				else _callback(new Error("Connection instance not found!"));
			});
		}
		// If no remote instances are available throw an error (to prevent false events from firing)
		// Else run the Async Parallel with a given limit
		if(parallelExecutionArray.length <= 0) callback(new Error("No Connections found!"));
		else async.parallelLimit(parallelExecutionArray, context.options.maxConcurrentConnections || 5, callback);
	}, context.options.maxConcurrentFiles || 10);
	context.queue.drain = function() {
		context.emit('drain');
	}
	// EventEmitter
	eventEmmiter.call(this);
}

// Inherit from EventEmitter
util.inherits(InstaDeploy, eventEmmiter);

InstaDeploy.prototype.watch = function(directoryPath, remotePath) {
	var context = this;
	// Watch Root**
	Watcher(directoryPath, remotePath, context.options.ignore || ['.git/**', 'node_modules/**'], function FILE_ON_CHANGE(PATH, directory, remote) {
		// -- ON FILE_CHANGE -- //
		// Clear any previous timeouts for SmartQueue
		clearTimeout(context.smartQueueTimeFrame);
		// Create a new timeout to flush the SmartQueue into the Async Queue
		context.smartQueueTimeFrame = setTimeout(function(){
			// Flush
			context.smartQueueFlush();
		}, context.options.queueTime || 1500);
		/* Implement a rename function */
		// Push File Data to SmartQueue
		context.smartQueueList.push({ localPath: PATH, remotePath: path.join(remote, path.relative(directory, PATH)), callback: function(error) {
			// If there is no upload error emit an uploaded event otherwise emit failed with error & path
			if(!error) context.emit('uploaded', null, path.relative(directory, PATH));
			else context.emit('failed', error, path.relative(directory, PATH));
		}});
	}, function FILE_ON_IGNORED(absolute, relative) {
		// -- ON FILE_IGNORED -- //
		// Emit and ignored event
		context.emit('ignored', absolute, relative);
	});
}

module.exports = InstaDeploy;