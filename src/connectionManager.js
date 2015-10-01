function connectionManger(connection, remote, disconnectedCallback, connectedCallback, failedCallback) {
	var manager = { retries: 0, connected: false, failed: false, error: null, shouldClose: false, timeout: null };
	/* Add Events instead of multiple callbacks */
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

module.exports = connectionManger;