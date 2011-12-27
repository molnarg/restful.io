var http   = require('http'),
    events  = require('events'),
    should = require('should');

var testPort = 6000;

var Session = require('../lib/session.js');

var Request = function(options) {
  var request = http.request({
    method : options.method,
    host :   'localhost',
    port :   testPort,
    path :   options.path,
    headers : { 'Content-Type' : options.content_type }
  });

  request.ready = false;
  request.on('response', function(res) {
    request.response = res;
    res.body = '';
    res.on('data', function(data) {
      res.body += data.toString();
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

  request.start = function() {
    request.end(options.data);
  }

  return request;
};

describe('A Session', function(){
  var session = new Session(),
      server = http.createServer(session.middleware);

  server.listen(testPort);

  describe('in response to an HTTP PUT request', function(){
    describe('with JSON-encoded object as payload (Content-Type is "application/json")', function() {
      var testObject = {a:1, b:2},
          testEvent = 'x/y';

      var request = new Request({
        method       : 'PUT',
        path         : '/' + testEvent,
        content_type : 'application/json',
        data         : JSON.stringify(testObject)
      });

      it('emits the decoded object as an event', function(done){
        request.start();
        session.once(testEvent, function(eventdata) {
          eventdata.should.eql(testObject);
          done();
        });
      });

      it('responds with 200 OK status code');
    });

    describe('with wrong JSON data as payload', function() {
      var testEvent = 'x/y';

      var request = new Request({
        method       : 'PUT',
        path         : '/' + testEvent,
        content_type : 'application/json',
        data         :  '"Error{}'
      });

      it('responds with 400 Bad Request status code', function(done){
        request.start()
        request.onReady(function() {
          request.response.statusCode.should.equal(400);
          done();
        });
      });
    });

    describe('with binary data as payload (Content-Type isn\'t "application/json")', function() {
      var testEvent = 'a',
          testData = 'test';

      var request = new Request({
        method       : 'PUT',
        path         : '/' + testEvent,
        content_type : 'application/octet-steam',
        data         :  testData
      });

      it('emits the HTTP stream object as an event', function(done){
        request.start();
        session.once(testEvent, function(stream) {
          stream.should.be.an.instanceof(events.EventEmitter);
          stream.should.have.property('readable');
          stream.should.have.property('pipe');
          stream.pipe.should.be.a('function');
          stream.on('data', function(data) {
            data.toString().should.equal(testData);
            done();
          });
        });
      });

      it('responds with 200 OK status code');
    });
  });

  describe('in response to an HTTP GET request', function() {
    describe('which indicates client side SSE support (Accept header is "text/event-stream")', function() {
      it('responds with 200 OK status code');

      it('streams matching events in \'data: {"type":"type", "event":"data"}\\n\\n\' format');

      it('never closes the connection, waits for the client to do so');
    });
    describe('which doesnt indicate client side SSE support', function() {
      it('responds with 200 OK status code');

      it('sends the name of the next matching event in the "Event" header field, and the data as the payload');

      it('closes the connection after the first event');
    });
  });
});
