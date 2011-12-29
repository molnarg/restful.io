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

describe('A Session', function(){
  var session = new Session(),
      server = http.createServer(session.middleware);

  server.listen(testPort);

  util.recordHistory(session);

  describe('in response to an HTTP PUT request', function(){
    describe('with JSON-encoded object as payload (Content-Type is "application/json")', function() {
      var event = util.random.event('object');

      var request = new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        headers : { 'Content-Type' : 'application/json' },
        data    : JSON.stringify(event.data)
      });

      it('responds with 200 OK status code', request.statusCodeShouldBe(200));

      it('emits the decoded object as an event', function(done){
        session.history.ever(event.type, function(eventdata) {
          eventdata.should.eql(event.data);
          done();
        });
      });
    });

    describe('with wrong JSON data as payload', function() {
      var event = util.random.event('object');

      var request = new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        headers : { 'Content-Type' : 'application/json' },
        data    :  '"Error{}'
      });

      it('responds with 400 Bad Request status code', request.statusCodeShouldBe(400));
    });

    describe('with binary data as payload (Content-Type isn\'t "application/json")', function() {
      var event = util.random.event('string'),
          content_type = 'application/octet-steam';

      var request = new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        headers : { 'Content-Type' : content_type },
        data    : event.data
      });

      it('responds with 200 OK status code', request.statusCodeShouldBe(200));

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
            event = { type: 'x/' + util.random.string(), data: util.random.object() };
            events.push(event);
            session.emit(event.type, event.data);
          }
        }
      });

      it('responds with 200 OK status code', request.statusCodeShouldBe(200));

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

      it('never closes the connection, waits for the client to do so', function() {
        request.ready.should.be.false;
        request.abort();
      });
    });

    describe('which doesnt indicate client side SSE support (Accept header isn\'t "text/event-stream")', function() {
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
        obj : new_test(util.random.event('object')),
        buf : new_test(util.random.event('buffer')),
        str : new_test(function(){
          var event = util.random.event('stream');
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
