var inherits         = require('util').inherits,
    parseUrl         = require('url').parse,
    parseQuerystring = require('querystring').parse,
    EventEmitter2    = require('eventemitter2').EventEmitter2,
    EventChannel     = require('./eventchannel');

var Session = module.exports = function() {
  EventEmitter2.call(this, {
    wildcard : true,
    delimiter : '/'
  });

  this.middleware = this.middleware.bind(this);
};

inherits(Session, EventEmitter2);

Session.prototype.middleware = function(req, res) {
  var url = parseUrl(req.url.substr(1));
  
  req.event = url.pathname;
  req.options = parseQuerystring(url.query);
  
  switch (req.method) {
    case 'GET' : return this.listen(req, res);
    case 'POST': return this.send(req, res);
    case 'PUT' : return this.send(req, res);
  }
};

Session.prototype.listen = function(req, res) {
  var channel, respond, self = this;
  
  channel = new EventChannel(req, res);
  
  respond = function(data) {
    channel.emit(this.event, data);
  };
  
  self.on(req.event, respond);
  channel.on('end', function() {
    self.off(req.event, respond);
  });  
};

Session.prototype.send = function(req, res) {
  var data, self = this;
  
  if (req.headers['content-type'] === 'application/json') {
    // JSON event. Receive, parse and then emit the whole request.
    
    data = '';
    req.on('data', function(chunk) {
      data += chunk.toString();
    });
    
    req.on('end', function() {
      try {
        data = JSON.parse(data);
      } catch(error) {
        res.statusCode = 400;
        res.end('JSON parse error.');
        return;
      }

      res.writeHead(200, {'Cache-Control' : 'no-cache'});
      res.end();

      self.emit(req.event, data);
    });
    
  } else {
    // Binary event. Emit the data stream as event.
    
    data = req;
    data.mime_type = req.headers['content-type'];

    req.on('end', function() {
      res.writeHead(200, {'Cache-Control' : 'no-cache'});
      res.end();
    });

    self.emit(req.event, data);
  }
};
