var recordHistory = function(ee) {
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

module.exports.recordHistory = recordHistory;
