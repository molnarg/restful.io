var inherits      = require('util').inherits,
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    Session       = require('./session');

var RestfulApi = module.exports = function() {
  EventEmitter2.call(this, {
    wildcard : true,
    delimiter : '/'
  });

  this.sessions = {};

  this.sessions.default = new Session();

  this.middleware = this.middleware.bind(this);
};

inherits(RestfulApi, EventEmitter2);

RestfulApi.prototype.middleware = function(req, res) {
  var sessionId, session;

  sessionId = req.headers['restfulio-session'];

  if (sessionId === undefined) {
    // Using default session
    session = this.sessions.root;
  } else if (this.sessions[sessionId] instanceof Session) {
    // Using existing session
    session = this.sessions[sessionId];
  } else {
    // Creating new session
    session = this.sessions[sessionId] = new Session();
    this.emit('newSession', session);
  }

  return session.middleware(req, res);
};

RestfulApi.prototype.listen = function(server, url) {
  server.use(url, this.middleware);
};

RestfulApi.prototype.emit = function(event, data) {
  var session;

  if (event !== 'newListener' && event !== 'end') {
    for (session in this.sessions) {
      session = this.sessions[session];

      if (!(session instanceof Session)) { continue; }

      session.emit(event, data);
    }
  }

  return EventEmitter2.prototype.emit.call(this, event, data);
};
