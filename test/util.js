var events = require('events');

var recordHistory = module.exports.recordHistory = function(ee) {
  var original_emit = ee.emit,
      events = [];

  ee.history = {};
  ee.history.ever = function(filter, callback) {
    var i;
    for (i = 0; i < events.length; i++) {
      if (events[i][0] === filter) {
        callback.apply(undefined, events[i].slice(1));
      }
    }

    ee.on(filter, callback);
  };

  ee.emit = function() {
    var i, args = Array.prototype.slice.call(arguments);

    events.push(args);

    for (i = 1; i < args.length; i++) {
      if (typeof args[i].emit === 'function') {
        //console.log('tracking');
        recordHistory(args[i]);
      }
    }

    return original_emit.apply(this, args);
  };
};

var random = module.exports.random = {
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
  },

  'buffer' : function() {
    return new Buffer(random.string());
  },

  'stream' : function() {
    var stream = new events.EventEmitter(),
        half1 = random.string(),
        half2 = random.string();

    stream.content = half1 + half2;
    stream.readable = true;
    stream.pipe = function(target) {
      target.write(half1);
      target.end(half2);
    };

    return stream;
  },

  'event' : function(data_type) {
    var event = {}, type = [],
        type_length = Math.ceil(Math.random()*3);

    for (var i=0; i<type_length; i++)
      type.push(random.string());

    event.type = type.join('/');
    event.data = random[data_type ? data_type : 'variable']();

    return event;
  }
};
