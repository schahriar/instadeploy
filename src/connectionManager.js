var eventEmmiter = require('events').EventEmitter;
var util = require('util');
var Client = require('scp2').Client;

var ConnectionManger = function Connection_Manger_Init(connection, remote) {
	this.retries = 0;
	this.connection = false;
	this.remote = remote;
	this.connected = false;
	this.failed = false;
	this.error = null;
	this.shouldClose = false;
	this.timeout = null;
	
	eventEmmiter.call(this);
}

util.inherits(ConnectionManger, eventEmmiter);

ConnectionManger.prototype.attempt = function Connection_Manger_Attempt_Init() {
	// Intialize
	this.AttemptConnection(true);
}

ConnectionManger.prototype.ErrorHandler = function Connection_Manger_Error_Handler(error) {
	var _this = this;
	if(error) {
		if (_this.retries <= 10) {
			_this.timeout = setTimeout(function(){
				_this.emit('disconnected', _this.remote, _this);
				_this.connected = false;
				_this.error = error;
				_this.retries++;
				clearTimeout(_this.timeout);
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
	if(!init) {
		_this.connection.sftp(new Function);
	}else{
		_this.connection = new Client({
			port: _this.remote.port || 22,
			host: _this.remote.host,
			username: _this.remote.username,
			password: _this.remote.password,
			privateKey: _this.remote.privateKey
		});
		_this.connection.sftp(function() { _this.ErrorHandler.apply(_this, arguments) });
		// Reset on connection
		_this.connection.on('connect', function() {
			_this.retries = 0;
			_this.connected = true;
			_this.error = null;
			_this.emit('connected', _this.remote, _this);
		});
		// Try to reconnect
		_this.connection.on('error', _this.ErrorHandler);
		_this.connection.on('end', function() {
			if(!_this.shouldClose) _this.ErrorHandler(true);
		});
		_this.connection.on('close', function() {
			if(!_this.shouldClose) _this.ErrorHandler(true);
		});
	}
}

module.exports = ConnectionManger;