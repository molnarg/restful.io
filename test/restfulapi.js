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
    var sessionId = random.string(),
        event = random.event();

    api.sessions[sessionId] = new Session();
    util.recordHistory(api.sessions.default, api.sessions[sessionId]);

    api.emit(event.type, event.data);

    it('forwards the event to all living Sessions', function() {
      api.sessions.default.history.contains(event.type).should.be.true;
      api.sessions[sessionId].history.contains(event.type).should.be.true;
      delete api.sessions[sessionId];
    });
  });

  describe('in case of an incoming HTTP request', function() {
    var emitRequest = function(session, event) {
      var headers = { 'Content-Type' : 'application/json' };
      if (session) { headers['Restfulio-Session'] = session; }

      return new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        data    : JSON.stringify(event.data),
        headers : headers
      });
    };

    describe('without "Restfulio-Session" HTTP header', function() {
      var event = random.event(),
          req = emitRequest(undefined, event);

      it('forwards the request to the default Session', req.whenReady(function() {
        api.sessions.default.history.contains(event.type).should.be.true;
      }));
    });

    describe('with "Restfulio-Session" HTTP header', function() {
      describe('when the header\'s value doesn\'t belong to any of the live sessions', function() {
        var sessionId = random.string(),
            event = random.event(),
            req = emitRequest(sessionId, event);

        it('creates a new Session with the given Session ID', req.whenReady(function() {
          api.sessions.should.have.property(sessionId);
          api.sessions[sessionId].should.be.an.instanceof(Session);
        }));

        it('forwards the request to the created Session', req.whenReady(function() {
          api.sessions[sessionId].history.contains(event.type).should.be.true;
        }));

        it('starts a Time To Live timer, and kills the Session if it expires');
      });

      describe('when the header\'s value belongs to a live sessions', function() {
        var sessionId = random.string(),
            event = random.event(),
            req = emitRequest(sessionId, event);

        api.sessions[sessionId] = new Session();
        util.recordHistory(api.sessions[sessionId]);

        it('forwards the request to the referenced Session', req.whenReady(function() {
          api.sessions[sessionId].history.contains(event.type).should.be.true;
        }));
        it('restarts the TTL timer of the referenced Session');
      });
    });
  });
});
