var fs = require("fs");
var temp = require('temp');
var path = require("path");
var chai = require("chai");
var InstaDeploy = require("./instadeploy.js");
var inspect = require("util").inspect;
var mkdirp = require('mkdirp');

// Automatically track and cleanup temp files at exit (causes an error after fs.mkdir)
// temp.track();

var should = chai.should();
var expect = chai.expect;

// Setup SFTP Server
var keypair = require('keypair');
var ssh2 = require('ssh2');
var OPEN_MODE = ssh2.SFTP_OPEN_MODE,
  STATUS_CODE = ssh2.SFTP_STATUS_CODE;
var STORE_BUFFERS = {};

var KEY = keypair().private;

new ssh2.Server({
  privateKey: KEY
}, function (client) {
  console.log('Client connected!');

  client.on('authentication', function (ctx) {
    if (ctx.method === 'password'
      && ctx.username === 'root'
      && ctx.password === 'test')
      ctx.accept();
    else
      ctx.reject();
  }).on('ready', function () {
    console.log('Client authenticated!');

    client.on('session', function (accept, reject) {
      var session = accept();
      session.on('sftp', function (accept, reject) {
        console.log('Client SFTP session');
        // `sftpStream` is an `SFTPStream` instance in server mode
        // see: https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
        var sftpStream = accept();
        sftpStream.on('STAT', function (reqid) {
          return sftpStream.status(reqid, STATUS_CODE.OK);
        })
        sftpStream.on('MKDIR', function (reqid) {
          console.log("MKDIR", arguments);
          return sftpStream.status(reqid, STATUS_CODE.OK);
        })
        sftpStream.on('OPEN', function (reqid, filename, flags, attrs) {
          var handle = new Buffer(filename);
          STORE_BUFFERS[handle.toString('utf8')] = {};
          sftpStream.handle(reqid, handle);
        }).on('WRITE', function (reqid, handle, offset, data) {
          // Write to memory
          STORE_BUFFERS[handle.toString('utf8')].data = data.toString('utf8');
          sftpStream.status(reqid, STATUS_CODE.OK);
        }).on('CLOSE', function (reqid, handle) {
          sftpStream.status(reqid, STATUS_CODE.OK);
          STORE_BUFFERS[handle.toString('utf8')].done = true;
        });
      });
    });
  }).on('end', function () {
    console.log('Client disconnected');
  });
}).listen(8635, '127.0.0.1', function () {
  console.log('Listening on port ' + this.address().port);
});

var Test = new InstaDeploy([
  {
    name: 'test',
    host: 'localhost',
    port: 8635,
    username: 'root',
    password: 'test',
    privateKey: KEY
  }
], {
    queueTime: 10,
    ignore: ['node_modules\\**', '.gitignore']
  });

/* DEBUG
Test.on('connect', function (remote) {
  console.log("::CLIENT::", "Connected to", remote.host)
})
Test.on('disconnect', function (remote) {
  console.log("::CLIENT::", "Disconnected from", remote.host)
})
Test.on('failed', function () {
  console.log("::CLIENT::", "Failed Upload", arguments)
})
Test.on('uploaded', function () {
  console.log("::CLIENT::", "Upload Complete", arguments)
})
Test.on('uploadStarted', function () {
  console.log("::CLIENT::", "Upload Started", arguments);
})
*/

describe('Test Suite', function () {
  var directory = temp.mkdirSync('InstaDeployTest');
  this.timeout(5500);
  Test.watch(directory, './test');
  it("Should Connect To SFTP", function (done) {
    Test.on('connect', function (remote) {
      done();
    })
  })
  it("Should Upload Files", function (done) {
    var fileName = 'test.js';
    fs.writeFile(path.join(directory, fileName), 'HelloWorld', function (error) {
      if (error) return done(error);
      Test.once('uploaded', function () {
        expect(STORE_BUFFERS['test/' + fileName].data).to.equal('HelloWorld');
        done();
      })
    })
  })
  it("Should Create Directories", function (done) {
    var filePath = 'dir/newTest.js';
    mkdirp.sync(path.dirname(path.join(directory, filePath)));
    fs.writeFile(path.join(directory, filePath), 'HelloWorld2', function (error) {
      if (error) return done(error);
      Test.once('uploaded', function () {
        expect(STORE_BUFFERS['test/' + filePath].data).to.equal('HelloWorld2');
        done();
      })
    })
  })
  it("Should Allow for Directory Nesting", function (done) {
    var filePath = 'src/test/new/nested/index.js';
    mkdirp.sync(path.dirname(path.join(directory, filePath)));
    fs.writeFile(path.join(directory, filePath), 'HelloFromFakeNodeModule', function (error) {
      if (error) return done(error);
      Test.once('uploaded', function () {
        expect(STORE_BUFFERS['test/' + filePath].data).to.equal('HelloFromFakeNodeModule');
        done();
      })
    })
  })
  it("Should Ignore .instadeploy file", function (done) {
    /* Make Paths with OS Delimiter */
    var filePath = 'test\\.instadeploy';
    mkdirp.sync(path.dirname(path.join(directory, filePath)));
    fs.writeFile(path.join(directory, filePath), 'HelloFromFakeNodeModule', function (error) {
      if (error) return done(error);
      Test.once('ignored', function (relative, absolute) {
        expect(path.basename(relative)).to.equal(path.basename(filePath));
        done();
      })
    })
  })
  it("Should Ignore Matching Directories", function (done) {
    /* Make Paths with OS Delimiter */
    var filePath = 'node_modules\\test\\index.js';
    mkdirp.sync(path.dirname(path.join(directory, filePath)));
    fs.writeFile(path.join(directory, filePath), 'HelloFromFakeNodeModule', function (error) {
      if (error) return done(error);
      Test.once('ignored', function (relative, absolute) {
        expect(relative).to.equal(path.dirname(filePath));
        done();
      })
    })
  })
  it("Should Ignore Matching Root Directory Files", function (done) {
    /* Make Paths with OS Delimiter */
    var filePath = '.gitignore';
    mkdirp.sync(path.dirname(path.join(directory, filePath)));
    fs.writeFile(path.join(directory, filePath), 'HelloFromFakeNodeModule', function (error) {
      if (error) return done(error);
      Test.once('ignored', function (relative, absolute) {
        expect(relative).to.equal(filePath);
        done();
      })
    })
  })
});

var Deployer = new InstaDeploy([
  {
    name: 'test',
    host: 'localhost',
    port: 8635,
    username: 'root',
    password: 'test',
    path: 'uploads',
    privateKey: KEY
  }
], {
    queueTime: 100,
    ignore: ['node_modules\\**', '.gitignore']
  });

describe('Deploy Test Suite', function () {
  this.timeout(5500);
  var directory = temp.mkdirSync('InstaDeployTest2');
  var directory2 = temp.mkdirSync('InstaDeployTest3');
  Deployer.watch(directory, './test2');
  it('Should Allow for Unique Host Paths', function (done) {
    var filePath = 'index.js';
    mkdirp.sync(path.dirname(path.join(directory, filePath)));
    fs.writeFileSync(path.join(directory, filePath), 'test');
    Deployer.once('uploaded', function () {
      expect(STORE_BUFFERS['uploads/test2/' + filePath].data).to.equal('test');
      done();
    })
  })
  it('Should Copy All Files on Initial Connection', function (done) {
    var filePath = 'src/test.js';
    mkdirp.sync(path.dirname(path.join(directory, filePath)));
    fs.writeFileSync(path.join(directory, filePath), 'test');
    Deployer.once('uploaded', function () {
      expect(STORE_BUFFERS['uploads/test2/' + filePath].data).to.equal('test');
      done();
    })
  })
  it('Should Ignore Matching Files on Initial Connection', function (done) {
    var filePath = 'node_modules\\test\\test.js';
    mkdirp.sync(path.dirname(path.join(directory2, filePath)));
    fs.writeFileSync(path.join(directory2, filePath), 'test');
    Deployer.once('ignored', function (relative, absolute) {
      expect(relative).to.equal(path.dirname(filePath));
      done();
    })
    Deployer.watch(directory2, './test3');
  })
})