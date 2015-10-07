# InstaDeploy
#### InstaDeploy Watches a folder and deploys using SFTP to multiple servers when changes are made. It is great for use in source deployment where a large number of hosts are at play.

# Installation
```javascript
npm install -g instadeploy
```

# Usage
You can use either **instadeploy** or **deploy** cmd/terminal command.

----
Setup a new host
```Batchfile
instadeploy add <unique_name> <host_ip> <username> <password> <unique_remote_path> <privateKey>
```

----
Ignore development folders (Ignore follows [Minimatch's](https://github.com/isaacs/minimatch) Glob Expressions Format)
```Batchfile
instadeploy ignore ".gitignore" "node_modules/**" ".git/**" <pattern4> <pattern5> ...
```

----
Watch a folder
```Batchfile
instadeploy watch <local_path> <common_remote_path>
```

----
Remove a host
```Batchfile
instadeploy remove <name>
```

----
Remove an ignore pattern
```Batchfil
instadeploy allow <pattern>
```

# API
Instance -> InstaDeploy(<Array:Objects>Hosts, <Object>Options)
Example:
```javascript
var fs = require('fs');
var InstaDeploy = require('instadeploy');
var Deployer = new InstaDeploy([
  { name: 'test', host: '127.0.0.1', port: 8085, username: 'root', password: 'test', path: 'uploads', privateKey: fs.readFileSync('/path/to/key') },
  { name: 'host2', host: '127.0.0.1', port: 8045, username: 'notroot', password: 'test2', path: 'test', privateKey: fs.readFileSync('/path/to/key2') }
], {
  ignore: ['node_modules\\**', '.gitignore']
})
```
## Options
- **maxConcurrentConnections**:   \<Number> 5
- **queueTime**:    \<Time:MS> 1500
- **ignore**:   \<Array> ['.git', 'node_modules']

## Events
- **attempt**: (args-> \<Object>Host, \<Int>NoOfRetries) Emitted when a new connection attempt is made
- **connect**: (args-> \<Object>Host, \<Int>NoOfRetries, \<Object>Handler) Emitted when a connection is made to one of the hosts
- **disconnect**: (args-> \<Object>Host, \<Int>NoOfRetries, \<Object>Handler) Emitted when a connection is lost
-   --------
- **uploadStarted**: (\<String>RelativePath, \<String>AbsolutePath, \<String>RemotePath) Emitted when a file has been queued for upload
- **uploaded**: (args-> \<String>RelativePath, \<String>AbsolutePath) Emitted when an upload has successfully completed
- **ignored**: (args-> \<String>RelativePath, \<String>AbsolutePath) Emitted when a file has been ignored
- **failed**: (args-> \<Error>Error, \<String>RelativePath, \<String>AbsolutePath) Emitted when an upload has failed
-   --------
- **start**: (args-> \<Int>NumberOfItems) Emitted when a new batch is queued for upload
- **end**: (args-> None) Emitted when all items of the batch have been uploaded

## Disclaimer
Passwords are written as clear-text into the config file *.instadeploy*. There will be an upcoming update that allows for password prompts before every watch but in the mean time you can use a privateKey only access by passing the privateKey absolute path or string to the CLI or API. You may store passwords as clear-text but only at your own risk.

## License
MIT &copy; Schahriar SaffarShargh - [Full License](https://github.com/schahriar/anti/blob/master/README.md)
