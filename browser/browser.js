
/*!
 * EventEmitter
 * Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

// TODO: own library, since tons of my libs use this :D

/**
 * Slice reference.
 */

var slice = [].slice;

/**
 * EventEmitter.
 */

function EventEmitter() {
  this.callbacks = {};
};

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 */

EventEmitter.prototype.on = function(event, fn){
  (this.callbacks[event] = this.callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 */

EventEmitter.prototype.emit = function(event){
  var args = slice.call(arguments, 1)
    , callbacks = this.callbacks[event];

  if (callbacks) {
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i](args);
    }
  }

  return this;
};

/*!
 * superagent
 * Copyright (c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

var superagent = function(exports){
  
  /**
   * Expose the request function.
   */
  
  exports = request;

  /**
   * Library version.
   */

  exports.version = '0.1.1';

  /**
   * Noop.
   */

  var noop = function(){};

  /**
   * Determine XHR.
   */

  function getXHR() {
    if (window.XMLHttpRequest
      && ('file:' != window.location.protocol || !window.ActiveXObject)) {
      return new XMLHttpRequest;
    } else {
      try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
      try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
      try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
      try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
    }
    return false;
  }

  /**
   * Removes leading and trailing whitespace, added to support IE.
   *
   * @param {String} s
   * @return {String}
   * @api private
   */

  var trim = ''.trim
    ? function(s) { return s.trim(); }
    : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

 /**
  * Check if `obj` is a function.
  *
  * @param {Mixed} obj
  * @return {Boolean}
  * @api private
  */
  
  function isFunction(obj) {
    return 'function' == typeof obj;
  }

  /**
   * Check if `obj` is an object.
   *
   * @param {Object} obj
   * @return {Boolean}
   * @api private
   */

  function isObject(obj) {
    if (null == obj) return false;
    var cons = obj.constructor;
    return cons && Object == cons;
  }

  /**
   * Serialize the given `obj`.
   *
   * @param {Object} obj
   * @return {String}
   * @api private
   */

  function serialize(obj) {
    if (!isObject(obj)) return obj;
    var pairs = [];
    for (var key in obj) {
      pairs.push(encodeURIComponent(key)
        + '=' + encodeURIComponent(obj[key]));
    }
    return pairs.join('&');
  }

  /**
   * Expose serialization method.
   */

   exports.serializeObject = serialize;

   /**
    * Parse the given x-www-form-urlencoded `str`.
    *
    * @param {String} str
    * @return {Object}
    * @api private
    */

  function parseString(str) {
    var obj = {}
      , pairs = str.split('&')
      , parts
      , pair;

    for (var i = 0, len = pairs.length; i < len; ++i) {
      pair = pairs[i];
      parts = pair.split('=');
      obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    }

    return obj;
  }

  /**
   * Expose parser.
   */

  exports.parseString = parseString;

  /**
   * Default MIME type map.
   * 
   *     superagent.types.xml = 'application/xml';
   * 
   */

  exports.types = {
      html: 'text/html'
    , json: 'application/json'
    , urlencoded: 'application/x-www-form-urlencoded'
    , 'form-data': 'application/x-www-form-urlencoded'
  };

  /**
   * Default serialization map.
   * 
   *     superagent.serialize['application/xml'] = function(obj){
   *       return 'generated xml here';
   *     };
   * 
   */

   exports.serialize = {
       'application/x-www-form-urlencoded': serialize
     , 'application/json': JSON.stringify
   };

   /**
    * Default parsers.
    * 
    *     superagent.parse['application/xml'] = function(str){
    *       return { object parsed from str };
    *     };
    * 
    */

  exports.parse = {
      'application/x-www-form-urlencoded': parseString
    , 'application/json': JSON.parse
  };

  /**
   * Parse the given header `str` into
   * an object containing the mapped fields.
   *
   * @param {String} str
   * @return {Object}
   * @api private
   */

  function parseHeader(str) {
    var lines = str.split(/\r?\n/)
      , fields = {}
      , index
      , line
      , field
      , val;

    lines.pop(); // trailing CRLF

    for (var i = 0, len = lines.length; i < len; ++i) {
      line = lines[i];
      index = line.indexOf(':');
      field = line.slice(0, index).toLowerCase();
      val = trim(line.slice(index + 1));
      fields[field] = val;
    }

    return fields;
  }

  /**
   * Initialize a new `Response` with the given `xhr`.
   *
   *  - set flags (.ok, .error, etc)
   *  - parse header
   *
   * Examples:
   *
   *  Aliasing `superagent` as `request` is nice:
   *
   *      request = superagent;
   *
   *  We can use the promise-like API, or pass callbacks:
   *
   *      request.get('/').end(function(res){});
   *      request.get('/', function(res){});
   *
   *  Sending data can be chained:
   *
   *      request
   *        .post('/user')
   *        .data({ name: 'tj' })
   *        .end(function(res){});
   *
   *  Or passed to `.send()`:
   *
   *      request
   *        .post('/user')
   *        .send({ name: 'tj' }, function(res){});
   *
   *  Or passed to `.post()`:
   *
   *      request
   *        .post('/user', { name: 'tj' })
   *        .end(function(res){});
   *
   * Or further reduced to a single call for simple cases:
   *
   *      request
   *        .post('/user', { name: 'tj' }, function(res){});
   *
   * @param {XMLHTTPRequest} xhr
   * @param {Object} options
   * @api private
   */

  function Response(xhr, options) {
    options = options || {};
    this.xhr = xhr;
    this.text = xhr.responseText;
    this.setStatusProperties(xhr.status);
    this.header = parseHeader(xhr.getAllResponseHeaders());
    this.setHeaderProperties(this.header);
    this.body = this.parseBody(this.text);
  }

  /**
   * Set header related properties:
   *
   *   - `.contentType` the content type without params
   *
   * A response of "Content-Type: text/plain; charset=utf-8"
   * will provide you with a `.contentType` of "text/plain".
   *
   * @param {Object} header
   * @api private
   */

  Response.prototype.setHeaderProperties = function(header){
    // TODO: moar!
    var params = (this.header['content-type'] || '').split(/ *; */);
    this.contentType = params.shift();
    this.setParams(params);
  };

  /**
   * Create properties from `params`.
   *
   * For example "Content-Type: text/plain; charset=utf-8"
   * would provide `.charset` "utf-8".
   *
   * @param {Array} params
   * @api private
   */

  Response.prototype.setParams = function(params){
    var param;
    for (var i = 0, len = params.length; i < len; ++i) {
      param = params[i].split(/ *= */);
      this[param[0]] = param[1];
    }
  };

  /**
   * Parse the given body `str`.
   *
   * Used for auto-parsing of bodies. Parsers
   * are defined on the `superagent.parse` object.
   *
   * @param {String} str
   * @return {Mixed}
   * @api private
   */

  Response.prototype.parseBody = function(str){
    var parse = exports.parse[this.contentType];
    return parse
      ? parse(str)
      : null;
  };

  /**
   * Set flags such as `.ok` based on `status`.
   *
   * For example a 2xx response will give you a `.ok` of __true__
   * whereas 5xx will be __false__ and `.error` will be __true__. The
   * `.clientError` and `.serverError` are also available to be more
   * specific, and `.statusType` is the class of error ranging from 1..5
   * sometimes useful for mapping respond colors etc.
   *
   * "sugar" properties are also defined for common cases. Currently providing:
   *
   *   - .noContent
   *   - .badRequest
   *   - .unauthorized
   *   - .notAcceptable
   *   - .notFound
   *
   * @param {Number} status
   * @api private
   */

  Response.prototype.setStatusProperties = function(status){
    var type = status / 100 | 0;

    // status / class
    this.status = status;
    this.statusType = type;

    // basics
    this.info = 1 == type;
    this.ok = 2 == type;
    this.clientError = 4 == type;
    this.serverError = 5 == type;
    this.error = 4 == type || 5 == type;

    // sugar
    this.accepted = 202 == status;
    this.noContent = 204 == status || 1223 == status;
    this.badRequest = 400 == status;
    this.unauthorized = 401 == status;
    this.notAcceptable = 406 == status;
    this.notFound = 404 == status;
  };

  /**
   * Expose `Response`.
   */

  exports.Response = Response;

  /**
   * Initialize a new `Request` with the given `method` and `url`.
   *
   * @param {String} method
   * @param {String} url
   * @api public
   */
  
  function Request(method, url) {
    var self = this;
    EventEmitter.call(this);
    this.method = method;
    this.url = url;
    this.header = {};
    this.set('X-Requested-With', 'XMLHttpRequest');
    this.on('end', function(){
      self.callback(new Response(self.xhr));
    });
  }

  /**
   * Inherit from `EventEmitter.prototype`.
   */

  Request.prototype = new EventEmitter;
  Request.prototype.constructor = Request;

  /**
   * Set header `field` to `val`, or multiple fields with one object.
   *
   * Examples:
   *
   *      req.get('/')
   *        .set('Accept', 'application/json')
   *        .set('X-API-Key', 'foobar')
   *        .end(callback);
   *
   *      req.get('/')
   *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
   *        .end(callback);
   *
   * @param {String|Object} field
   * @param {String} val
   * @return {Request} for chaining
   * @api public
   */

  Request.prototype.set = function(field, val){
    if (isObject(field)) {
      for (var key in field) {
        this.set(key, field[key]);
      }
      return this;
    }
    this.header[field.toLowerCase()] = val;
    return this;
  };

  /**
   * Set Content-Type to `type`, mapping values from `exports.types`.
   *
   * Examples:
   *
   *      superagent.types.xml = 'application/xml';
   *
   *      request.post('/')
   *        .type('xml')
   *        .data(xmlstring)
   *        .end(callback);
   *      
   *      request.post('/')
   *        .type('application/xml')
   *        .data(xmlstring)
   *        .end(callback);
   *
   * @param {String} type
   * @return {Request} for chaining
   * @api public
   */

  Request.prototype.type = function(type){
    this.set('Content-Type', exports.types[type] || type);
    return this;
  };

  /**
   * Send `data`, defaulting the `.type()` to "json" when
   * an object is given.
   *
   * Examples:
   *
   *       // querystring
   *       request.get('/search')
   *         .data({ search: 'query' })
   *         .end(callback)
   *
   *       // multiple data "writes"
   *       request.get('/search')
   *         .data({ search: 'query' })
   *         .data({ range: '1..5' })
   *         .data({ order: 'desc' })
   *         .end(callback)
   *
   *       // manual json
   *       request.post('/user')
   *         .type('json')
   *         .data('{"name":"tj"})
   *         .end(callback)
   *       
   *       // auto json
   *       request.post('/user')
   *         .data({ name: 'tj' })
   *         .end(callback)
   *       
   *       // manual x-www-form-urlencoded
   *       request.post('/user')
   *         .type('form-data')
   *         .data('name=tj')
   *         .end(callback)
   *       
   *       // auto x-www-form-urlencoded
   *       request.post('/user')
   *         .type('form-data')
   *         .data({ name: 'tj' })
   *         .end(callback)
   *
   * @param {String|Object} data
   * @return {Request} for chaining
   * @api public
   */

  Request.prototype.data = function(data){
    var obj = isObject(data);

    // merge
    if (obj && isObject(this._data)) {
      for (var key in data) {
        this._data[key] = data[key];
      }
    } else {
      this._data = data;
    }

    if ('GET' == this.method) return this;
    if (!obj) return this;
    if (this.header['content-type']) return this;
    this.type('json');
    return this;
  };

  /**
   * Send `.data()` and `.end()` with optional callback `fn`.
   *
   * Examples:
   *
   *       // equivalent to .end()
   *       request.post('/user').send();
   *       
   *       // equivalent to .data(user).end()
   *       request.post('/user').send(user);
   *       
   *       // equivalent to .data(user).end(callback)
   *       request.post('/user').send(user, callback);
   *       
   *       // equivalent to ..end(callback)
   *       request.post('/user').send(callback);
   *
   * @param {Object|String} data
   * @param {Function} fn
   * @return {Request} for chaining
   * @api public
   */

  Request.prototype.send = function(data, fn){
    if (isFunction(data)) {
      this.end(data);
    } else if (data) {
      this.data(data).end(fn);
    } else {
      this.end();
    }
    return this;
  };

  /**
   * Initiate request, invoking callback `fn(res)`
   * with an instanceof `Response`.
   *
   * @param {Function} fn
   * @return {Request} for chaining
   * @api public
   */

  Request.prototype.end = function(fn){
    var self = this
      , xhr = this.xhr = getXHR()
      , data = this._data || null;

    // store callback
    this.callback = fn || noop;

    // state change
    xhr.onreadystatechange = function(){
      if (4 == xhr.readyState) self.emit('end');
    };

    // querystring
    if ('GET' == this.method && null != data) {
      this.url += '?' + exports.serializeObject(data);
      data = null;
    }

    // initiate request
    xhr.open(this.method, this.url, true);

    // body
    if ('GET' != this.method && 'HEAD' != this.method) {
      // serialize stuff
      var serialize = exports.serialize[this.header['content-type']];
      if (serialize) data = serialize(data);
    }

    // set header fields
    for (var field in this.header) {
      xhr.setRequestHeader(field, this.header[field]);
    }

    // send stuff
    xhr.send(data);
    return this;
  };
  
  /**
   * Expose `Request`.
   */
  
  exports.Request = Request;

  /**
   * Issue a request:
   *
   * Examples:
   *
   *    request('GET', '/users').end(callback)
   *    request('/users').end(callback)
   *    request('/users', callback)
   *
   * @param {String} method
   * @param {String|Function} url or callback
   * @return {Request}
   * @api public
   */

  function request(method, url) {
    // callback
    if ('function' == typeof url) {
      return new Request('GET', method).end(url);
    }

    // url first
    if (1 == arguments.length) {
      return new Request('GET', method);
    }

    return new Request(method, url);
  }

  /**
   * GET `url` with optional callback `fn(res)`.
   *
   * @param {String} url
   * @param {Mixed} data
   * @param {Function} fn
   * @return {Request}
   * @api public
   */

  request.get = function(url, data, fn){
    var req = request('GET', url);
    if (isFunction(data)) fn = data, data = null;
    if (data) req.data(data);
    if (fn) req.end(fn);
    return req;
  };

  /**
   * DELETE `url` with optional callback `fn(res)`.
   *
   * @param {String} url
   * @param {Function} fn
   * @return {Request}
   * @api public
   */

  request.del = function(url, fn){
    var req = request('DELETE', url);
    if (fn) req.end(fn);
    return req;
  };

  /**
   * POST `url` with optional `data` and callback `fn(res)`.
   *
   * @param {String} url
   * @param {Mixed} data
   * @param {Function} fn
   * @return {Request}
   * @api public
   */

  request.post = function(url, data, fn){
    var req = request('POST', url);
    if (data) req.data(data);
    if (fn) req.end(fn);
    return req;
  };

  /**
   * PUT `url` with optional `data` and callback `fn(res)`.
   *
   * @param {String} url
   * @param {Mixed} data
   * @param {Function} fn
   * @return {Request}
   * @api public
   */

  request.put = function(url, data, fn){
    var req = request('PUT', url);
    if (data) req.data(data);
    if (fn) req.end(fn);
    return req;
  };

  return exports;
  
}({});

;!function(exports, undefined) {

  var isArray = Array.isArray;
  var defaultMaxListeners = 10;

  function init() {
    this._events = new Object;
  }

  function configure(conf) {

    if (conf) {
      this.wildcard = conf.wildcard;
      this.delimiter = conf.delimiter || '.';

      if (this.wildcard) {
        this.listenerTree = new Object;
      }
    }
  }

  function EventEmitter(conf) {
    this._events = new Object;
    configure.call(this, conf);
  }

  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return;
    }

    var listeners;

    if (i === type.length && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return tree;
      } else {
        for (var leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return tree;
      }
    }

    if (type[i] === '*' || tree[type[i]]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (type[i] === '*') {
        for (var branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = searchListenerTree(handlers, type, tree[branch], i+1);
          }
        }
        return listeners;
      }

      listeners = searchListenerTree(handlers, type, tree[type[i]], i+1);
    }


    if (tree['*']) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, tree['*'], i+1);
    }

    return listeners;
  };

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = new Object;
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  };

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(null, arguments);
      //console.log 'x', this
      //fn.apply(this, arguments);
    };

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {
    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener') {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      
      if (!this._all && 
        !this._events.error && 
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return true;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m;
        if (this._events.maxListeners !== undefined) {
          m = this._events.maxListeners;
        } else {
          m = defaultMaxListeners;
        }

        if (m && m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if(!this._all) {
      this._all = [];
    }

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers;

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leaf = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      if('undefined' === typeof leaf) { return this; }
      handlers = leaf._listeners;
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
    }

    if (isArray(handlers)) {

      var position = -1;

      for (var i = 0, length = handlers.length; i < length; i++) {
        if (handlers[i] === listener ||
          (handlers[i].listener && handlers[i].listener === listener) ||
          (handlers[i]._origin && handlers[i]._origin === listener)) {
          position = i;
          break;
        }
      }

      if (position < 0) {
        return this;
      }

      if(this.wildcard) {
        leaf._listeners.splice(position, 1)
      }
      else {
        this._events[type].splice(position, 1);
      }

      if (handlers.length === 0) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }
    else if (handlers === listener ||
      (handlers.listener && handlers.listener === listener) ||
      (handlers._origin && handlers._origin === listener)) {
      if(this.wildcard) {
        delete leaf._listeners;
      }
      else {
        delete this._events[type];
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leaf = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      if('undefined' === typeof leaf) { return this; }
      leaf._listeners = null;
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  exports.EventEmitter2 = EventEmitter;

}(typeof exports === 'undefined' ? window : exports);
(function() {
  var CoupledEventEmitter2, Hook, LongPoll, ServerSentEvents, countListeners, findAndRemove, insert, newEventRequest, selectMoreGeneral;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  selectMoreGeneral = function(event1, event2) {
    var index, more_general, part1, part2, _len, _ref;
    if ((event1.length !== event2.length) || (event1.level === event2.level)) {
      return;
    }
    more_general = void 0;
    _ref = event1.parts;
    for (index = 0, _len = _ref.length; index < _len; index++) {
      part1 = _ref[index];
      part2 = event2.parts[index];
      if (part1 === '*' && part2 === '*') {
        continue;
      } else if (part1 === '*') {
        if (event2 === more_general) return;
        more_general = event1;
      } else if (part2 === '*') {
        if (event1 === more_general) return;
        more_general = event2;
      } else if (part1 !== part2) {
        return;
      }
    }
    return more_general;
  };

  insert = function(new_event, tree) {
    var event, event_name, more_general;
    for (event_name in tree) {
      event = tree[event_name];
      more_general = selectMoreGeneral(new_event, event);
      if (more_general === void 0) {
        continue;
      } else {
        if (new_event === more_general) {
          new_event.shadow[event_name] = event;
          delete tree[event_name];
        } else {
          return insert(new_event, event.shadow);
        }
      }
    }
    tree[new_event.type] = new_event;
    return tree;
  };

  findAndRemove = function(name_to_remove, tree) {
    var event, eventname, result;
    if (name_to_remove in tree) {
      event = tree[name_to_remove];
      delete tree[name_to_remove];
      return {
        event: event,
        parent: tree
      };
    } else {
      for (eventname in tree) {
        event = tree[eventname];
        result = findAndRemove(name_to_remove, event.shadow);
        if (result !== void 0) return result;
      }
    }
  };

  countListeners = function(type, tree) {
    if (type.length !== 0) {
      if (type[0] in tree) {
        return countListeners(type.slice(1), tree[type[0]]);
      } else {
        return 0;
      }
    } else {
      if (!(tree._listeners != null)) {
        return 0;
      } else if (typeof tree._listeners === 'function') {
        return 1;
      } else {
        return tree._listeners.length;
      }
    }
  };

  CoupledEventEmitter2 = (function() {
    var addIncomingEvent, removeIncomingEvent;

    __extends(CoupledEventEmitter2, EventEmitter2);

    addIncomingEvent = function(type) {
      var event, parent, parts;
      event = {
        type: type,
        parts: parts = type.split(this.delimiter),
        length: parts.length,
        level: parts.filter(function(x) {
          return x === '*';
        }).length,
        shadow: {}
      };
      parent = insert(event, this._incoming);
      if (parent === this._incoming) return this.emit('enableIncoming', type);
    };

    removeIncomingEvent = function(type) {
      var event, parent, result, shadowed_event, shadowed_name, _ref, _results;
      result = findAndRemove(type, this._incoming);
      if (result === void 0) return;
      event = result.event, parent = result.parent;
      if (parent === this._incoming) this.emit('disableIncoming', type);
      _ref = event.shadow;
      _results = [];
      for (shadowed_name in _ref) {
        shadowed_event = _ref[shadowed_name];
        parent = insert(shadowed_event, this._incoming);
        if (parent === this._incoming) {
          _results.push(this.emit('enableIncoming', type));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    function CoupledEventEmitter2(options) {
      var template;
      CoupledEventEmitter2.__super__.constructor.call(this, options);
      this._incoming = {};
      if (options.wildcard) {
        template = function(original_method, before, after, method) {
          return function(type) {
            var c_after, c_before, value;
            c_before = countListeners(type.split(this.delimiter), this.listenerTree);
            value = EventEmitter2.prototype[original_method].apply(this, arguments);
            c_after = countListeners(type.split(this.delimiter), this.listenerTree);
            if ((c_before === before || (before === void 0 && c_before > 0)) && c_after === after) {
              if (type !== 'enableIncoming' && type !== 'disableIncoming') {
                method.call(this, type);
              }
            }
            return value;
          };
        };
        this.on = template('on', 0, 1, addIncomingEvent);
        this.off = template('off', 1, 0, removeIncomingEvent);
        this.removeAllListeners = template('removeAllListeners', void 0, 0, removeIncomingEvent);
        this.incomingEvents = function() {
          var type, _results;
          _results = [];
          for (type in this._incoming) {
            _results.push(type);
          }
          return _results;
        };
      } else {
        template = function(original_method, before, after, event) {
          return function(type) {
            var exists_after, exists_before, value;
            exists_before = this._events[type] != null;
            value = EventEmitter2.prototype[original_method].apply(this, arguments);
            exists_after = this._events[type] != null;
            if (exists_before === before && exists_after === after) {
              this.emit(event, type);
            }
            return value;
          };
        };
        this.on = template('on', false, true, 'enableIncoming');
        this.off = template('off', true, false, 'disableIncoming');
        this.removeAllListeners = template('removeAllListeners', true, false, 'disableIncoming');
        this.incomingEvents = function() {
          var type, _results;
          _results = [];
          for (type in this._events) {
            _results.push(type);
          }
          return _results;
        };
      }
    }

    return CoupledEventEmitter2;

  })();

  ServerSentEvents = (function() {

    __extends(ServerSentEvents, EventEmitter2);

    function ServerSentEvents(options) {
      var _ref;
      this.options = options;
      this.stop = __bind(this.stop, this);
      this.start = __bind(this.start, this);
      this.onmessage = __bind(this.onmessage, this);
      this.living = (_ref = this.options.living) != null ? _ref : true;
      if (this.living) this.start();
    }

    ServerSentEvents.prototype.onmessage = function(e) {
      var event, type, _ref;
      _ref = JSON.parse(e.data), type = _ref.type, event = _ref.event;
      return this.emit(type, event);
    };

    ServerSentEvents.prototype.start = function() {
      this.source = new EventSource(this.options.url);
      return this.source.addEventListener('message', this.onmessage, false);
    };

    ServerSentEvents.prototype.stop = function() {
      return this.source.close();
    };

    return ServerSentEvents;

  })();

  LongPoll = (function() {

    __extends(LongPoll, EventEmitter2);

    function LongPoll(options) {
      var _ref;
      this.options = options;
      this.living = (_ref = this.options.living) != null ? _ref : true;
      if (this.living) this.start();
    }

    LongPoll.prototype.start = function() {
      var name, random, value, _ref;
      var _this = this;
      this.living = true;
      random = Math.floor(Math.random() * 1000);
      this.request = superagent('GET', this.options.url);
      _ref = this.options.headers;
      for (name in _ref) {
        value = _ref[name];
        this.request.set(name, value);
      }
      return this.request.end(function(res) {
        if (res.ok) _this.emit(res.header['hookio-event'], res.body);
        if (_this.living != null) return _this.start();
      });
    };

    LongPoll.prototype.stop = function() {
      this.living = false;
      return this.request.xhr.abort();
    };

    return LongPoll;

  })();

  newEventRequest = function(options) {
    if (window.EventSource != null) {
      return new ServerSentEvents(options);
    } else {
      return new LongPoll(options);
    }
  };

  Hook = (function() {
    var create_url, forwardEvents;

    __extends(Hook, CoupledEventEmitter2);

    forwardEvents = function(from, to) {
      return from.onAny(function(data) {
        console.log('forwarding', this.event, data);
        return EventEmitter2.prototype.emit.call(to, this.event, data);
      });
    };

    create_url = function(base_url, event, id) {
      return 'http://' + base_url + event.split('::').join('/') + '?id=' + id;
    };

    function Hook(base_url) {
      this.base_url = base_url != null ? base_url : window.hook_address;
      this.emit = __bind(this.emit, this);
      this.disable = __bind(this.disable, this);
      this.enable = __bind(this.enable, this);
      Hook.__super__.constructor.call(this, {
        wildcard: true,
        delimiter: '::'
      });
      this.original_emit = CoupledEventEmitter2.prototype.emit;
      this.eventSources = {};
      this.id = '' + Math.floor(Math.random() * 1000000);
      this.on('enableIncoming', this.enable);
      this.on('disableIncoming', this.disable);
    }

    Hook.prototype.enable = function(event) {
      console.log('enable', event);
      if (this.eventSources[event] != null) {
        return console.log('bug, listening to event twice');
      }
      this.eventSources[event] = newEventRequest({
        url: create_url(this.base_url, event, this.id),
        living: true
      });
      return forwardEvents(this.eventSources[event], this);
    };

    Hook.prototype.disable = function(event) {
      console.log('disable', event.name);
      if (!(this.eventSources[event] != null)) {
        return console.log('bug, deleting none existing poll');
      }
      this.eventSources[event].stop();
      return delete this.eventSources[event];
    };

    Hook.prototype.emit = function(event, data, callback) {
      var method, url;
      if (event === 'newListener' || event === 'enableIncoming' || event === 'disableIncoming') {
        return this.original_emit(event, data, callback);
      }
      console.log('sending', event, data);
      if (!(data != null)) return console.log('no data');
      method = callback != null ? 'put' : 'post';
      url = create_url(this.base_url, event, this.id);
      superagent(method, url).data(data).end(function() {
        return console.log('sending', event, data, 'success');
      });
      return this.original_emit(event, data, callback);
    };

    return Hook;

  })();

  window.Hook = Hook;

  document.cookie = "id=" + Math.floor(Math.random() * 1000000) + "; path=/";

}).call(this);
