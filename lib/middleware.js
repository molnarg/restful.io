(function() {
  var Hook, emit, emit_id, fs, hook, listen, querystring, url;

  Hook = require('hook.io').Hook;

  url = require('url');

  querystring = require('querystring');

  fs = require('fs');

  hook = void 0;

  emit_id = void 0;

  listen = function(eventname, options, req, res) {
    var respond;
    respond = function(data) {
      if ((emit_id !== void 0) && (emit_id === req.headers['hookio-id'])) return;
      res.writeHead(200, {
        'Connection': 'close',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Hookio-Event': this.event,
        'Hookio-Id': req.headers['hookio-id']
      });
      res.end(JSON.stringify(data));
      hook.off(eventname, respond);
      req.stat.end = new Date();
      return console.log('stat: ', req.method, req.url, req.stat.start, req.stat.end);
    };
    hook.on(eventname, respond);
    return req.on('close', function() {
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
        'Connection': 'close',
        'Cache-Control': 'no-cache'
      });
      res.end();
      req.stat.end = new Date();
      return console.log('stat: ', req.method, req.url, req.stat.start, req.stat.end);
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
