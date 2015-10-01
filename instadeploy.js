var walker = require('./src/walk.js');
var watcher = require('./src/watch.js');
var Client = require('scp2').Client;
var async = require('async');

var InstaDeploy = function(options, remoteArray) {
	var context = this;
	
	this.options = options || {};
	this.clientInstances = {};
	
	// Push New instances of scp2 for every remote server provided
	remoteArray.forEach(function(remote) {
		// node-scp2 takes care of storing previous connection and recreating a new one once closed https://github.com/spmjs/node-scp2/blob/master/lib/client.js#L55-L58
		context.clientInstances[remote.name] = new Client({
			port: remote.port || 22,
			host: remote.host,
			username: remote.username,
			password: remote.password,
		});
	})
	// Create an Async queue for uploads
	this.queue = async.queue(function (file, callback) {
		var parallelExecutionArray = [];
		for(var remote in context.clientInstances) {
			parallelExecutionArray.push(function(callback){
				if(context.clientInstances[remote.name]) context.clientInstances[remote.name].upload(file.localPath, file.remotePath, callback);
				else callback(new Error("Connection instance not found!"));
			})
		}
		async.parallelLimit(parallelExecutionArray, this.options.maxConcurrentConnections || 5, callback);
	}, this.options.maxConcurrentFiles || 10);
}

module.exports = InstaDeploy;