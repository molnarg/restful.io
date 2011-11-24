(function() {
  var Hook, emit, hook, listen, querystring, url;

  Hook = require('hook.io').Hook;

  url = require('url');

  querystring = require('querystring');

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
      var eventname, options, pathname, query, _ref;
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
