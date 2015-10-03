var eventEmmiter = require('events').EventEmitter;
var util = require('util');
var Client = require('scp2').Client;

var ConnectionManger = function Connection_Manger_Init(remote) {
	this.retries = 0;
	this.remote = remote;
	this.connection = null;
	this.connected = false;
	this.failed = false;
	this.error = null;
	this.shouldClose = false;
	this.timeout = null;
	
	eventEmmiter.call(this);
}

util.inherits(ConnectionManger, eventEmmiter);

ConnectionManger.prototype.connect = function Connection_Manger_Attempt_Init() {
	// Intialize
	this.AttemptConnection(true);
}

ConnectionManger.prototype.ErrorHandler = function Connection_Manger_Error_Handler(error) {
	var _this = this;
	// If an error is present handle it
	if(error) {
		// If Connection retries are less than max retries re-attempt
		// Otherwise consider Connection as failed
		if (_this.retries <= 10) {
			// Attempt timeout
			_this.timeout = setTimeout(function(){
				// Emit disconnected event
				_this.emit('disconnected', _this.remote, _this);
				_this.connected = false;
				_this.error = error;
				_this.retries++;
				clearTimeout(_this.timeout);
				// Re-attempt
				_this.AttemptConnection();
			}, 1000);
		}else{
			_this.failed = true;
			_this.emit('failed', _this);
		}
	}
}

ConnectionManger.prototype.AttemptConnection = function Connection_Manager_Attempt(init) {
	var _this = this;
	// Connect to Server
	_this.emit('attempting', _this.remote, _this);
	// If Connection is already initialized attempt reconnection
	// Otherwise initialize Connection
	if(!init) {
		_this.connection.sftp(function(error){
			_this.ErrorHandler.apply(_this, arguments) 
		});
	}else{
		_this.connection = new Client({
			port: _this.remote.port || 22,
			host: _this.remote.host,
			username: _this.remote.username,
			password: _this.remote.password,
			privateKey: _this.remote.privateKey
		});
		// Handle Initial Connection
		_this.connection.sftp(function() { _this.ErrorHandler.apply(_this, arguments) });
		// Reset on connection
		_this.connection.on('ready', function() {
			_this.retries = 0;
			_this.connected = true;
			_this.error = null;
			_this.emit('connected', _this.remote, _this);
		});
		// Try to reconnect
		_this.connection.on('error', _this.ErrorHandler);
		_this.connection.on('end', function() {
			/* ShouldClose is not implemented */
			if(!_this.shouldClose) _this.ErrorHandler(true);
		});
		_this.connection.on('close', function() {
			if(!_this.shouldClose) _this.ErrorHandler(true);
		});
	}
}

module.exports = ConnectionManger;