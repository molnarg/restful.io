require('should');

var http    = require('http'),
    events = require('events');

var recordHistory = module.exports.recordHistory = function(ee) {
  var args = Array.prototype.slice.call(arguments),
      original_emit = ee.emit,
      events = [];

  if (args.length !== 1) {
    return args.forEach(function(ee){
      recordHistory(ee);
    });
  }

  ee.history = {
    get : function(filter, n) {
      var i, matching = [];
      for (i = 0; i < events.length; i++) {
        if (events[i][0] === filter) {
          matching.push(events[i].slice(1));
        }
      }
      if (n !== undefined) {
        n.should.be.above(-1 - matching.length);
        n.should.be.below(matching.length);
        return matching[(matching.length + n) % matching.length];
      } else {
        return matching;
      }
    },

    first : function(filter) { return ee.history.get(filter, 0); },
    last : function(filter) { return ee.history.get(filter, -1); },

    ever : function(filter, callback) {
      ee.history.get(filter).forEach(function(eventArgs){
        callback.apply(undefined, eventArgs);
      });
      ee.on(filter, callback);
    },

    contains : function(filter) {
      return 0 < ee.history.get(filter).length;
    }
  };

  ee.emit = function() {
    var i, args = Array.prototype.slice.call(arguments);

    events.push(args);

    for (i = 1; i < args.length; i++) {
      if (args[i] && typeof args[i].emit === 'function') {
        recordHistory(args[i]);
      }
    }

    return original_emit.apply(this, args);
  };
};

var random = module.exports.random = {
  'null' : function() { return null; },

  'number' : function() { return Math.floor(Math.random()*100); },

  'string' : function() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",
        string_length = Math.ceil(Math.random()*5),
        string = '';

    for (var i=0; i<string_length; i++)
      string += chars.substr(Math.floor(Math.random()*chars.length), 1);

    return string;
  },

  'array' : function() {
    var array_length = Math.floor(Math.random()*3),
        array = [];

    for (var i=0; i<array_length; i++)
      array.push(random.variable());

    return array;
  },

  'object' : function() {
    var no_of_properties = Math.ceil(Math.random()*3),
        object = {};

    for (var i=0; i<no_of_properties; i++)
      object[random.string()] = random.variable();

    return object;
  },

  'variable' : function() {
    var types = ['null', 'number', 'string', 'array', 'object'],
        type = types[Math.floor(Math.random()*5)];

    return random[type]();
  },

  'buffer' : function() {
    return new Buffer(random.string());
  },

  'stream' : function() {
    var stream = new events.EventEmitter(),
        half1 = random.string(),
        half2 = random.string();

    stream.content = half1 + half2;
    stream.readable = true;
    stream.pipe = function(target) {
      target.write(half1);
      target.end(half2);
    };

    return stream;
  },

  'event' : function(data_type) {
    var event = {}, type = [],
        type_length = Math.ceil(Math.random()*3);

    for (var i=0; i<type_length; i++)
      type.push(random.string());

    event.type = type.join('/');
    event.data = random[data_type ? data_type : 'variable']();

    return event;
  }
};

module.exports.requestTemplate = function(templateOptions) {
  var Request = function(options) {
    var req = http.request({
      method  : options.method,
      host    : templateOptions.host,
      port    : templateOptions.port,
      path    : options.path,
      headers : options.headers
    });

    recordHistory(req);

    req.on('socket', function() {
      if (options.sent) {
        setTimeout(options.sent, 20);
      }
    });

    req.ready = false;
    req.on('response', function(res) {
      req.res = res;
      res.body = '';
      res.chunks = [];
      res.on('data', function(data) {
        req.emit('data', data);
        res.body += data.toString();
        res.chunks.push(data.toString());
      });
      res.on('end', function() {
        req.ready = true;
        req.emit('ready');
      });
    });

    req.statusCodeShouldBe = function(statusCode) {
      return function(done) {
        req.history.ever('response', function(res) {
          res.should.have.status(statusCode);
          done();
        });
      };
    };

    req.whenReady = function(assertionCallback) {
      return function(done) {
        req.history.ever('response', function() {
          assertionCallback();
          done();
        });
      };
    };

    if (options.start !== false) {
      req.end(options.data);
    }

    return req;
  };

  return Request;
};
