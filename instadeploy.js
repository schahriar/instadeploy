var path = require('path');
var walker = require('./src/walk.js');
var watcher = require('./src/watch.js');
var Client = require('scp2').Client;
var async = require('async');
var uniq = require('lodash.uniq');
var crypto = require('crypto');

// http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
function randomValueHex(len) {
    return crypto.randomBytes(Math.ceil(len/2))
        .toString('hex') // convert to hexadecimal format
        .slice(0,len);   // return required number of characters
}

function managedConnection(connection, remote, disconnectedCallback, connectedCallback, failedCallback) {
	var manager = { retries: 0, connected: false, failed: false, error: null, shouldClose: false, timeout: null };
	// Connect to Server
	function handleError(error) {
		if(error) {
			if (manager.retries <= 10) {
				manager.timeout = setTimeout(function(){
					if(disconnectedCallback) disconnectedCallback(manager);
					manager.connected = false;
					manager.error = error;
					manager.retries++;
					clearTimeout(manager.timeout);
					attempt();
				}, 1000);
			}else{
				manager.failed = true;
				if(failedCallback) failedCallback(manager);
			}
		}
	}
	function attempt(init) {
		if(!init) {
			connection.sftp(new Function);
		}else{
			connection = new Client({
				port: remote.port || 22,
				host: remote.host,
				username: remote.username,
				password: remote.password,
			});
			connection.sftp(handleError);
			// Reset on connection
			connection.on('connect', function() {
				manager.retries = 0;
				manager.connected = true;
				manager.error = null;
				if(connectedCallback) connectedCallback();
			});
			// Try to reconnect
			connection.on('error', handleError);
			connection.on('end', function() {
				if(!manager.shouldClose) handleError(true);
			})
			connection.on('close', function() {
				if(!manager.shouldClose) handleError(true);
			})
		}
	}
	// Intialize
	attempt(true);
	
	return manager;
}

var InstaDeploy = function (remoteArray, options) {
	var context = this;
	
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
		})
		// Reset SmartQueue
		context.smartQueueList = [];
	}
	
	// Push New instances of scp2 for every remote server provided
	if(remoteArray) remoteArray.forEach(function(remote) {
		if(!remote.name) remote.name = randomValueHex(8);
		managedConnection(context.clientInstances[remote.name], remote);
	})
	// Create an Async queue for uploads
	context.queue = async.queue(function (file, callback) {
		var parallelExecutionArray = [];
		for(var name in context.clientInstances) { 
			parallelExecutionArray.push(function(callback){
				if(context.clientInstances[name]) context.clientInstances[name].upload(file.localPath, file.remotePath, function(error){
					if(!error) console.log("UPLOADED", file);
					callback();
				});
				else callback(new Error("Connection instance not found!"));
			});
		}
		async.parallelLimit(parallelExecutionArray, context.options.maxConcurrentConnections || 5, callback);
	}, context.options.maxConcurrentFiles || 10);
}

InstaDeploy.prototype.watch = function(directoryPath, remotePath) {
	var context = this;
	walker(directoryPath, function WALKER_ON_FILE(error, directPath, relativePath, stats) {
		// FILE FUNCTION
		/* Add Ignore Options here */
		watcher(directPath, function FILE_ON_CHANGE(event, fileName) {
			clearTimeout(context.smartQueueTimeFrame);
			context.smartQueueTimeFrame = setTimeout(function(){
				context.smartQueueFlush();
			}, context.options.queueTime || 3000);
			/* Implement a rename function */
			context.smartQueueList.push({ localPath: directPath, remotePath: path.join(remotePath, relativePath), callback: function(error){
				if(!error) console.log("DONE", directPath, path.join(remotePath, relativePath));
			}});
		});
	}, function WALKER_ON_DIRECTORY(error, directPath, relativePath, callback) {
		// DIRECTORY FUNCTION
		callback();
	}, function WALKER_DONE() {
		// DONE FUNCTION
		
	})
}

module.exports = InstaDeploy;