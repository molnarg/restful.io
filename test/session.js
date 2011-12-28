require('should');

var http    = require('http'),
    events  = require('events'),
    Session = require('../lib/session.js'),
    util    = require('./util');

var testPort = 6000;

var Request = function(options) {
  var req = http.request({
    method  : options.method,
    host    : 'localhost',
    port    : testPort,
    path    : options.path,
    headers : options.headers
  });

  util.recordHistory(req);

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

  if (options.start !== false) {
    req.end(options.data);
  }

  return req;
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

  util.recordHistory(session);

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
        session.history.ever(event.type, function(eventdata) {
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
        data    :  '"Error{}'
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
        session.history.ever(event.type, function(stream) {
          stream.should.be.an.instanceof(events.EventEmitter);
          stream.should.have.property('readable');
          stream.should.have.property('pipe');
          stream.pipe.should.be.a('function');
          stream.history.ever('data', function(data) {
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
      var i, event, events = [];

      var request = new Request({
        method  : 'GET',
        path    : '/x/*',
        headers : { 'Accept' : 'text/event-stream' },
        sent    : function() {
          for (i = 0; i < 3; i++) {
            event = { type: 'x/' + random.string(), data: random.object() };
            events.push(event);
            session.emit(event.type, event.data);
          }
        }
      });

      it('streams matching events in \'data: {"type":"type", "event":"data"}\\n\\n\' format', function(done) {
        var n = 0;

        request.history.ever('data', function(chunk) {
          var parsed_event;

          chunk = chunk.toString();
          chunk.substr(0, 6).should.equal('data: ');
          chunk.substr(chunk.length-2).should.equal('\n\n');

          parsed_event = JSON.parse(chunk.substr(6, chunk.length-8));
          parsed_event.should.have.property('type');
          parsed_event.type.should.eql(events[n].type);
          parsed_event.should.have.property('event');
          parsed_event.event.should.eql(events[n].data);

          if (++n === events.length) {
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
      var new_test = function(event) {
        return {
          event : event,
          req : new Request({
            method  : 'GET',
            path    : '/' + event.type,
            sent    : function() {
              session.emit(event.type, event.data);
            }
          })
        };
      };

      var tests = {
        obj : new_test(random.event('object')),
        buf : new_test(random.event('buffer')),
        str : new_test(function(){
          var event = random.event('stream');
          event.data.mime_type = 'text/plain';
          return event;
        }()),
      };

      var whenReady = function(assertions_callback) {
        return function(done) {
          tests.obj.req.history.ever('ready', function(){
            tests.buf.req.history.ever('ready', function(){
              tests.str.req.history.ever('ready', function(){
                assertions_callback();
                done();
              });
            });
          });
        };
      };

      it('responds with 200 OK status code', whenReady(function() {
        for (var testcase in tests) {
          tests[testcase].req.res.should.have.status(200);
        };
      }));

      it('sets the Event header to the name of the event', whenReady(function() {
        for (var testcase in tests) {
          tests[testcase].req.res.headers.should.have.property('event');
          tests[testcase].req.res.headers.event.should.eql(tests[testcase].event.type);
        };
      }));

      it('closes the connection after the first event', whenReady(function() {
        for (var testcase in tests) {
          tests[testcase].req.ready.should.be.true;
        };
      }));

      describe('in case the event is not stream or buffer', function() {
        it('sets the Content-Type header to "application/json"', whenReady(function() {
          tests.obj.req.res.headers.should.have.property('content-type');
          tests.obj.req.res.headers['content-type'].should.eql('application/json');
        }));

        it('sends the JSON-encoded object as the response body', whenReady(function() {
          JSON.parse(tests.obj.req.res.body).should.eql(tests.obj.event.data);
        }));
      });

      describe('in case the event is stream or buffer', function() {
        it('sets the Content-Type header to the mime_type attribute of the event', whenReady(function() {
          tests.str.req.res.headers.should.have.property('content-type');
          tests.str.req.res.headers['content-type'].should.eql('text/plain');
        }));

        it('sets the Content-Type header to "application/octet-stream" if no mime_type is specified', whenReady(function() {
          tests.buf.req.res.headers.should.have.property('content-type');
          tests.buf.req.res.headers['content-type'].should.eql('application/octet-stream');
        }));

        it('streams the buffer/stream as the response body', whenReady(function() {
          tests.buf.req.res.body.should.eql(tests.buf.event.data.toString());
          tests.str.req.res.body.should.eql(tests.str.event.data.content);
          tests.str.req.res.chunks.should.have.length(2);
        }));
      });
    });
  });
});
