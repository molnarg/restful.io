var util         = require('util'),
    EventEmitter = require('events').EventEmitter;

function handleLongPoll(res, endCallback) {
  return function(event, data) {
    var streaming = data instanceof EventEmitter &&
                    data.readable &&
                    typeof data.pipe === 'function';
    
    if (!streaming && !(data instanceof Buffer)) {
      data = new Buffer(JSON.stringify(data));
      data.mime_type = 'application/json';
    }
  
    res.writeHead(200, {
      'Event'         : event,
      'Content-Type'  : data.mime_type || 'application/octet-stream',
      'Cache-Control' : 'no-cache'
    });
    
    if (streaming) {
      data.pipe(res);
      data.on('end', endCallback);
      data.on('close', endCallback);
    } else {
      res.end(data);
      endCallback();
    }
  };
}

function handleServerSentEvents(res) {
  res.writeHead(200, {
    'Connection'    : 'keep-alive',
    'Content-Type'  : 'text/event-stream',
    'Cache-Control' : 'no-cache'
  });
  
  return function(event, data) {
    res.write("data: " + JSON.stringify({type: event, event: data}) + "\n\n");
  };
}

var EventChannel = module.exports = function(req, res) {
  var self = this;
  
  EventEmitter.call(self);
  
  self.req = req;
  self.res = res;
  
  self.req.on('close', function() { // close -> end?
    self.end();
  });
  
  if (req.headers.accept === 'text/event-stream') {
    self.send = handleServerSentEvents(res);
  } else {
    self.send = handleLongPoll(res, function() {self.end();});
  }
};

util.inherits(EventChannel, EventEmitter);

EventChannel.prototype.emit = function(event, data) {
  if (event !== 'newListener' && event !== 'end') {
    this.send(event, data);
  }

  return EventEmitter.prototype.emit.call(this, event, data);
};

EventChannel.prototype.end = function() {
  this.res.end();
  EventEmitter.prototype.emit.call(this, 'end');
};
