var http   = require('http'),
    events  = require('events'),
    should = require('should');

var Session = require('../lib/session.js');

describe('A Session', function(){
  var session = new Session(),
      server = http.createServer(session.middleware);
  
  server.listen(6000);
  
  session.request = function(method, event, type, payload) {
    var request = http.request({
      method : method,
      host :   'localhost',
      port :   6000,
      path :   event,
      headers : { 'Content-Type' : type }
    });
    
    if (payload !== undefined) {
      setTimeout(function(){
        request.end(payload);
      }, 0);
    }
    
    return request;
  };
  
  describe('in response to an HTTP PUT request', function(){
    describe('with JSON-encoded object as payload (Content-Type is "application/json")', function() {
      var request = function(object) {
        session.request('PUT', '/x/y', 'application/json', JSON.stringify(object));
      };
      
      it('responds with 200 OK status code');
      
      it('emits the decoded object as an event', function(done){
        var testObject = {a:1, b:2};
        request(testObject);
        session.once('x/y', function(eventdata) {
          eventdata.should.eql(testObject);
          done();
        });
      });
    });

    describe('with wrong JSON data as payload', function() {
      var request = function() {
        return session.request('PUT', '/x/y', 'application/json', '"Error{}');
      };
      
      it('responds with 400 Bad Request status code', function(done){
        request().on('response', function(res) {
          res.statusCode.should.equal(400);
          done();
        });
      });
    });

    describe('with binary data as payload (Content-Type isn\'t "application/json")', function() {
      var request = function(data) {
        session.request('PUT', '/x/y', 'application/octet-stream', data);
      };
      
      it('responds with 200 OK status code');
      
      it('emits the HTTP stream object as an event', function(done){
        var testString = 'test';
        request(testString);
        session.once('x/y', function(stream) {
          stream.should.be.an.instanceof(events.EventEmitter);
          stream.should.have.property('readable');
          stream.should.have.property('pipe');
          stream.pipe.should.be.a('function');
          stream.on('data', function(data) {
            data.toString().should.equal(testString);
            done();
          });
        });
      });
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
