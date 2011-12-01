(function() {
  var EventEmitter, EventRequest, Hook, LongPoll, ServerSentEvents, emit, emit_id, fs, hook, listen, querystring, url;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Hook = require('hook.io').Hook;

  url = require('url');

  querystring = require('querystring');

  fs = require('fs');

  EventEmitter = require('events').EventEmitter;

  ServerSentEvents = (function() {

    __extends(ServerSentEvents, EventEmitter);

    function ServerSentEvents(req, res) {
      this.req = req;
      this.res = res;
    }

    ServerSentEvents.prototype.emit = function(type, event) {};

    return ServerSentEvents;

  })();

  LongPoll = (function() {

    __extends(LongPoll, EventEmitter);

    function LongPoll(req, res) {
      var _this = this;
      this.req = req;
      this.res = res;
      this.req.on('close', function() {
        return EventEmitter.prototype.emit.call(_this, 'end');
      });
      /*
          console.log 'longpoll:', @req.method, @req.url
          @on 'end', =>
            req.stat.end = new Date()
            console.log "stat: #{req.method} #{req.url}",
                        "#{req.stat.start.getHours()}:#{req.stat.start.getMinutes()}:#{req.stat.start.getSeconds()}", '-',
                        "#{req.stat.end.getHours()}:#{req.stat.end.getMinutes()}:#{req.stat.end.getSeconds()}"
      */
    }

    LongPoll.prototype.emit = function(type, event) {
      var emitRequest, headers;
      var _this = this;
      if (type === 'newListener') {
        return LongPoll.__super__.emit.call(this, type, event);
      }
      headers = {
        'Hookio-Event': type,
        'Hookio-Id': this.req.headers['hookio-id'],
        'Cache-Control': 'no-cache'
      };
      if (typeof event === 'object' && event instanceof this.req.__proto__.constructor) {
        emitRequest = event;
        headers['Content-Type'] = emitRequest.headers['Content-Type'];
        this.res.writeHead(200, headers);
        emitRequest.on('data', function(chunk) {
          return _this.res.write(chunk);
        });
        emitRequest.on('end', function() {
          return _this.res.end();
        });
      } else {
        headers['Content-Type'] = 'application/json';
        this.res.writeHead(200, headers);
        this.res.end(JSON.stringify(event));
      }
      return EventEmitter.prototype.emit.call(this, 'end');
    };

    return LongPoll;

  })();

  EventRequest = (function() {

    function EventRequest(req, res) {
      if (req.headers.accept === 'text/event-stream') {
        this.__proto__ = new ServerSentEvents(req, res);
      } else {
        this.__proto__ = new LongPoll(req, res);
      }
    }

    return EventRequest;

  })();

  hook = void 0;

  emit_id = void 0;

  listen = function(eventname, options, req, res) {
    var event_req, respond;
    event_req = new EventRequest(req, res);
    respond = function(data) {
      if ((emit_id !== void 0) && (emit_id === req.headers['hookio-id'])) return;
      return event_req.emit(this.event, data);
    };
    hook.on(eventname, respond);
    return event_req.on('end', function() {
      return hook.off(eventname, respond);
    });
  };

  emit = function(eventname, options, req, res) {
    var data;
    data = '';
    req.on('data', function(chunk) {
      return data += chunk.toString();
    });
    return req.on('end', function() {
      try {
        data = JSON.parse(data);
      } catch (error) {
        res.statusCode = 400;
        res.end("JSON parse error.");
        return;
      }
      emit_id = req.headers['hookio-id'];
      hook.emit(eventname, data);
      emit_id = void 0;
      res.writeHead(200, {
        'Cache-Control': 'no-cache'
      });
      return res.end();
    });
  };

  module.exports = function(h) {
    hook = h;
    return function(req, res, next) {
      var client_path, eventname, location, options, pathname, query, _ref;
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT',
          'Access-Control-Allow-Headers': 'Content-Type, Hookio-Id, X-Requested-With'
        });
        return res.end();
      }
      if (req.url === '/client.js') {
        location = req.headers.host + req.originalUrl.match(/.*\//);
        res.write("window.hook_address = '" + location + "';");
        client_path = __dirname + '/../browser/browser.js';
        fs.readFile(client_path, function(err, content) {
          return res.end(content);
        });
        return;
      }
      _ref = url.parse(req.url), pathname = _ref.pathname, query = _ref.query;
      eventname = pathname.split('/').filter(function(x) {
        return x.length > 0;
      }).join('::');
      options = querystring.parse(query);
      switch (req.method) {
        case 'GET':
          return listen(eventname, options, req, res);
        case 'POST':
          return emit(eventname, options, req, res);
      }
    };
  };

}).call(this);
