(function() {
  var Hook, emit, fs, hook, listen, querystring, url;

  Hook = require('hook.io').Hook;

  url = require('url');

  querystring = require('querystring');

  fs = require('fs');

  hook = new Hook({
    name: 'rest',
    debug: true
  });

  hook.start();

  listen = function(eventname, options, req, res) {
    return hook.once(eventname, function(data) {
      return res.end(JSON.stringify(data));
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
      hook.emit(eventname, data);
      return res.end();
    });
  };

  module.exports = function() {
    return function(req, res) {
      var eventname, location, options, pathname, query, _ref;
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
      }
      if (req.url === '/client.js') {
        location = req.headers.host + req.originalUrl.match(/.*\//);
        res.write("window.hook_address = '" + location + "';");
        fs.readFile('browser/browser.js', function(err, content) {
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
