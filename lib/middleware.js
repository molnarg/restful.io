(function() {
  var EventChannel, EventEmitter, Hook, emit, emit_id, fs, hook, listen, querystring, url;

  Hook = require('hook.io').Hook;

  url = require('url');

  querystring = require('querystring');

  fs = require('fs');

  EventEmitter = require('events').EventEmitter;

  EventChannel = require('./eventchannel');

  hook = void 0;

  emit_id = void 0;

  listen = function(eventname, options, req, res) {
    var event_req, respond;
    event_req = new EventChannel(req, res);
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
