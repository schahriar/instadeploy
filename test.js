var fs = require("fs");
var temp = require('temp');
var path = require("path");
var chai = require("chai");
var InstaDeploy = require("./instadeploy.js");
var inspect = require("util").inspect;

// Automatically track and cleanup temp files at exit
temp.track();

var should = chai.should();
var expect = chai.expect;

// Setup SFTP Server
var keypair = require('keypair');
var ssh2 = require('ssh2');
var OPEN_MODE = ssh2.SFTP_OPEN_MODE,
  STATUS_CODE = ssh2.SFTP_STATUS_CODE;
var STORE_BUFFERS = {};

var KEY = "-----BEGIN RSA PRIVATE KEY-----"
  + "\nMIIEowIBAAKCAQEAlGMMUmn73JHeyZ2auaVhjxcVJOfKOrhGW2kjmGUmVIaBurrEmfyISWuv"
  + "\n6fAqghICS+NM4Ln+rb1njC1M49pxjg25BBYZrW/myFc6wx84w+FWrtZo5xLU6+80FWHOEhNq"
  + "\nM2tanig6BUQZsagVeqeFa5LH1tzLMUzZn+WctpINq8I4OsadQsUrosnZooOs1lqmeG7faAWk"
  + "\nW87Vd1sR1H1G24k2Evz2Yn/jfjf8Tn8vLkGX7bPDL6as3Vh7xG9lJq+7eqGDHjgZ3J8prPsu"
  + "\nbYvMgVsFfqUfAHn/YyfzRlfwp8b95L6zIGDxrkjduMt2ZNvZFZV2gxgRgAymt/RdvwRWuQID"
  + "\nAQABAoIBAQCSR/6atE6NR+QoP82LXCUL6cZ3ZmWvc4Awlzp2/qhFxX/YdExiPVihgJ6f8ZoG"
  + "\nNfi7lS1xkQonfsO4pePZ77voPVD6XUsc9ma9c3jDaGEOgXNx0n8B5Uev+1UOCygaG7ejTx67"
  + "\nMY7ZKCRoRfo+uyzFOqL1Bx7s0ATuI25VcTA29C4UOCMR+wa1IC3VU+Ms6gjxyE4WGY370cwL"
  + "\nuebcs08prQA/kYRxiMu5SBNKmcqH45b47JcrV3CjXYd67iIGv93RvVj6U39eZvygqIr/iKTm"
  + "\nmzNLBGdKGYIAwVRA2U76+7K3D/db6Q/r/bGrX9qGhVgmDhhedFKhdQd8sNfMTxZdAoGBAOwu"
  + "\naql+j61/+1NW+icWTwwyo+DDS3n+GTeK2AEl1QntXeBR5o9kFYJh+WiJrwihGlu+9TtGrJcT"
  + "\nAIsNqaR/JRX3Ka4nhHC7T01C+EsJZRedacWpZB4Dcw6gDxvtH+TO5e/ABow6MQWbnfmdV/WG"
  + "\nKoV8Kt2lUA6L9+Wv66zLdS6DAoGBAKDWp9noQDBDDqwfTUaeJFxB7bjL2oKovh/ux1feYkMh"
  + "\nsCC5Eo0BTZ574tpWOL3491uUKgLaMNFueF+QlIsfZbLdT7KaVf+K/wYIZXuGJnGAI/oEr25p"
  + "\nnTHrSFa0M6cS4+S+ulp3cZ+qVqzVzj5BlVJNTyrnL3I5FoN47AVr8SETAoGARG6qjxPRs5bK"
  + "\njno8HwkyvDkMDLrpap56VgKP1b1NfgPd2HpCkLeSF+YlaunB4oEzbvPkgFlY9qkV1jSOO9Bv"
  + "\nQW8ND535nORY9Oz7nlpJhU8h75jGHoAnXUx5NEE/pX9hVldQTl8qBxLw8ftqGgTW2zh//xrA"
  + "\nGIbrvAx9/+IvwNsCgYAZJdbyzEyU/zchFHfZrcpTnn9T4JPW0BmCFqyWgY/tnSvTwfwzjduc"
  + "\nBxTOPKL8mRvb9sumzITLijFKB+oh4pPdJptaeqUtoocDY3aynKQQJQ/6/JaNdff9ISObYuuc"
  + "\nmOiHEIdEs95RL6oDth5cP5bgWnQhaipR+rkZb2O/6UO3fwKBgGkTxFKWKsMIyB3uepgpmebQ"
  + "\nVdAA+oMqeRTksNnLyoZ6hXxwd7IvEhQu7vqd2CfeFfaQnIG9p0KDj4PMXlQ4/afMHsQL7Zm3"
  + "\nQVc4f/KrAe2t2I0fl4pIFjzyReUy5lmgVnvG3fS4ZmOCozLNUlzxawW7oRdhE4jnit2keQ7D"
  + "\nN1Nk"
  + "\n-----END RSA PRIVATE KEY-----";

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
        sftpStream.on('STAT', function(reqid){
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

var Deployer = new InstaDeploy([
  {
    name: 'test',
    host: 'localhost',
    port: 8635,
    username: 'root',
    password: 'test',
    privateKey: KEY
  }
], {
    ignoreFiles: ['.gitignore', '.git', 'node_modules']
  });
Deployer.on('connect', function (remote) {
  console.log("::CLIENT::", "Connected to", remote.host)
})
Deployer.on('disconnect', function (remote) {
  console.log("::CLIENT::", "Disconnected from", remote.host)
})
Deployer.on('failed', function () {
  console.log("::CLIENT::", "Failed Upload", arguments)
})
Deployer.on('uploaded', function () {
  console.log("::CLIENT::", "Upload Complete", arguments)
})
Deployer.on('uploadStarted', function () {
  console.log("::CLIENT::", "Upload Started", arguments);
})



describe('Test Suite', function(){
  var directory = temp.mkdirSync('InstaDeployTest');
  this.timeout(5500);
  Deployer.watch(directory, './test');
	it("Should Connect To SFTP", function(done){
    Deployer.on('connect', function (remote) {
      done();
    })
	})
  it("Should Upload Files", function(done){
    var fileName = 'test.js';
    fs.writeFile(path.join(directory, fileName), 'HelloWorld', function(error) {
      if(error) return done(error);
      Deployer.on('uploaded', function () {
        expect(STORE_BUFFERS['test/'+fileName].data).to.equal('HelloWorld');
        done();
      })
    })
  })
});