require('should');

var http       = require('http'),
    events     = require('events'),
    RestfulApi = require('../lib/restfulapi.js'),
    Session    = require('../lib/session.js'),
    util       = require('./util'),
    random     = util.random;

var testPort = 6000;

var Request = util.requestTemplate({
  host : 'localhost',
  port : testPort
});

describe('The Restful API', function(){
  var api = new RestfulApi(),
      server = http.createServer(api.middleware);

  server.listen(testPort);

  util.recordHistory(api);

  it('creates a default Session before accepting HTTP requests', function() {
    api.should.have.property('sessions');
    api.sessions.should.have.property('default');
    api.sessions.default.should.be.an.instanceof(Session);
  });

  describe('when emit is called on it', function() {
    var event = random.event();

    api.sessions.session1 = new Session();
    util.recordHistory(api.sessions.default, api.sessions.session1);

    api.emit(event.type, event.data);

    it('forwards the event to all living Sessions', function() {
      api.sessions.default.history.contains(event.type).should.be.true;
      api.sessions.session1.history.contains(event.type).should.be.true;
    });
  });

  describe('in case of an incoming HTTP request', function() {
    describe('without "Restfulio-Session" HTTP header', function() {
      it('forwards the request to the default Session');
    });

    describe('with "Restfulio-Session" HTTP header', function() {
      describe('when the header\'s value doesn\'t belong to any of the live sessions', function() {
        it('creates a new Session with the given Session ID');
        it('forwards the request to the created Session');
        it('starts a Time To Live timer, and kills the Session if it expires');
      });

      describe('when the header\'s value belongs to a live sessions', function() {
        it('forwards the request to the referenced Session');
        it('restarts the TTL timer of the referenced Session');
      });
    });
  });
});
