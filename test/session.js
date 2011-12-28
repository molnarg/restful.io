var http   = require('http'),
    events  = require('events'),
    should = require('should');

var testPort = 6000;

var Session = require('../lib/session.js');

var Request = function(options) {
  var request = http.request({
    method  : options.method,
    host    : 'localhost',
    port    : testPort,
    path    : options.path,
    headers : options.headers
  });

  request.ready = false;
  request.on('response', function(res) {
    request.res = res;
    res.body = '';
    res.chunks = [];
    res.on('data', function(data) {
      res.body += data.toString();
      res.chunks.push(data.toString());
    });
    res.on('end', function() {
      request.ready = true;
      request.emit('ready');
    });
  });

  request.onReady = function(callback) {
    if (request.ready) {
      callback();
    } else {
      request.on('ready', callback);
    }
  };

  request.onChunk = function(callback) {
    var n = 0;

    if (request.res) {
      if (request.res.chunks) {
        for (n = 0; n < request.res.chunks.length; n++) {
          callback(n, request.res.chunks[n]);
        }
      }

      request.res.on('data', function(data) {
        callback(n++, data.toString());
      });
    } else {
      request.on('response', function(res) {
        res.on('data', function(data) {
          callback(n++, data.toString());
        });
      });
    }
  };

  request.start = function() {
    request.end(options.data);
  };

  request.statusCodeShouldBe = function(statusCode) {
    return function(done) {
      if (request.res !== undefined) {
        request.res.statusCode.should.equal(statusCode);
        done();
      } else request.on('response', function(res) {
        res.statusCode.should.equal(statusCode);
        done();
      });
    };
  };

  if (options.start === true) {
    request.start();
  }

  return request;
};

var random = {
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

describe('A Session', function(){
  var session = new Session(),
      server = http.createServer(session.middleware);

  server.listen(testPort);

  describe('in response to an HTTP PUT request', function(){
    describe('with JSON-encoded object as payload (Content-Type is "application/json")', function() {
      var event = random.event('object');

      var request = new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        headers : { 'Content-Type' : 'application/json' },
        data    : JSON.stringify(event.data)
      });

      it('emits the decoded object as an event', function(done){
        request.start();
        session.once(event.type, function(eventdata) {
          eventdata.should.eql(event.data);
          done();
        });
      });

      it('responds with 200 OK status code', request.statusCodeShouldBe(200));
    });

    describe('with wrong JSON data as payload', function() {
      var event = random.event('object');

      var request = new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        headers : { 'Content-Type' : 'application/json' },
        data    :  '"Error{}',
        start   : true
      });

      it('responds with 400 Bad Request status code', request.statusCodeShouldBe(400));
    });

    describe('with binary data as payload (Content-Type isn\'t "application/json")', function() {
      var event = random.event('string');

      var request = new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        headers : { 'Content-Type' : 'application/octet-steam' },
        data    : event.data
      });

      it('emits the HTTP stream object as an event', function(done){
        request.start();
        session.once(event.type, function(stream) {
          stream.should.be.an.instanceof(events.EventEmitter);
          stream.should.have.property('readable');
          stream.should.have.property('pipe');
          stream.pipe.should.be.a('function');
          stream.on('data', function(data) {
            data.toString().should.equal(event.data);
            done();
          });
        });
      });

      it('responds with 200 OK status code', request.statusCodeShouldBe(200));
    });
  });

  describe('in response to an HTTP GET request', function() {
    describe('which indicates client side SSE support (Accept header is "text/event-stream")', function() {
      var request = new Request({
        method  : 'GET',
        path    : '/x/*',
        headers : { 'Accept' : 'text/event-stream' },
        start   : true
      });

      it('streams matching events in \'data: {"type":"type", "event":"data"}\\n\\n\' format', function(done) {
        var i, event, events = [];

        for (i = 0; i < 3; i++) {
          event = { type: 'x/' + random.string(), data: random.object() };
          events.push(event);
          session.emit(event.type, event.data);
        }

        request.onChunk(function(index, chunk) {
          var parsed_event;

          chunk.substr(0, 6).should.equal('data: ');
          chunk.substr(chunk.length-2).should.equal('\n\n');

          parsed_event = JSON.parse(chunk.substr(6, chunk.length-8));
          parsed_event.should.have.property('type');
          parsed_event.type.should.eql(events[index].type);
          parsed_event.should.have.property('event');
          parsed_event.event.should.eql(events[index].data);

          if (index === events.length - 1) {
            done();
          }
        });
      });

      it('responds with 200 OK status code', request.statusCodeShouldBe(200));

      it('never closes the connection, waits for the client to do so', function() {
        request.ready.should.be.false;
        request.abort();
      });
    });

    describe('which doesnt indicate client side SSE support', function() {
      it('responds with 200 OK status code');

      it('sends the name of the next matching event in the "Event" header field, and the data as the payload');

      it('closes the connection after the first event');
    });
  });
});
