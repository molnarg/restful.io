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
    request.response = res;
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

  request.start = function() {
    request.end(options.data);
  };

  request.statusCodeShouldBe = function(statusCode) {
    return function(done) {
      if (request.response !== undefined) {
        request.response.statusCode.should.equal(statusCode);
        done();
      } else request.on('response', function(response) {
        response.statusCode.should.equal(statusCode);
        done();
      });
    };
  };

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
  }
};

var RandomEvent = function(data_type) {
  var type_length = Math.ceil(Math.random()*3),
      type = [];

  for (var i=0; i<type_length; i++)
    type.push(random.string());

  this.type = type.join('/');
  this.data = random[data_type ? data_type : 'variable']();
  console.log('random event', this);
};

describe('A Session', function(){
  var session = new Session(),
      server = http.createServer(session.middleware);

  server.listen(testPort);

  describe('in response to an HTTP PUT request', function(){
    describe('with JSON-encoded object as payload (Content-Type is "application/json")', function() {
      var event = new RandomEvent('object');

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
      var event = new RandomEvent('object');

      var request = new Request({
        method  : 'PUT',
        path    : '/' + event.type,
        headers : { 'Content-Type' : 'application/json' },
        data    :  '"Error{}'
      });

      request.start();

      it('responds with 400 Bad Request status code', request.statusCodeShouldBe(400));
    });

    describe('with binary data as payload (Content-Type isn\'t "application/json")', function() {
      var event = new RandomEvent('string');

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
