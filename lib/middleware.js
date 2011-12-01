(function() {
  var EventEmitter, Hook, LongPoll, ServerSentEvents, emit, emit_id, fs, hook, listen, newEventRequest, querystring, url;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  Hook = require('hook.io').Hook;

  url = require('url');

  querystring = require('querystring');

  fs = require('fs');

  EventEmitter = require('events').EventEmitter;

  ServerSentEvents = (function() {

    __extends(ServerSentEvents, EventEmitter);

    function ServerSentEvents(req, res) {
      var _this = this;
      this.req = req;
      this.res = res;
      this.emit = __bind(this.emit, this);
      this.res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      this.req.on('close', function() {
        return EventEmitter.prototype.emit.call(_this, 'end');
      });
    }

    ServerSentEvents.prototype.emit = function(type, event) {
      var eventString;
      if (type === 'newListener') {
        return ServerSentEvents.__super__.emit.call(this, type, event);
      }
      eventString = "data: " + JSON.stringify({
        type: type,
        event: event
      }) + "\n\n";
      return this.res.write(eventString);
    };

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
            console.log "longpoll stat: #{req.method} #{req.url}",
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

  newEventRequest = function(req, res) {
    if (req.headers.accept === 'text/event-stream') {
      return new ServerSentEvents(req, res);
    } else {
      return new LongPoll(req, res);
    }
  };

  hook = void 0;

  emit_id = void 0;

  listen = function(eventname, options, req, res) {
    var event_req, respond;
    event_req = newEventRequest(req, res);
    respond = function(data) {
      if ((emit_id != null) && (options.id != null) && emit_id === options.id) {
        return;
      }
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
      var _ref;
      try {
        data = JSON.parse(data);
      } catch (error) {
        res.statusCode = 400;
        res.end("JSON parse error.");
        return;
      }
      emit_id = (_ref = options.id) != null ? _ref : void 0;
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
      req.stat = {
        start: new Date(),
        stop: void 0
      };
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT',
          'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With'
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
