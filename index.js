var chokidar = require('chokidar');
var anymatch = require('anymatch');
var EventEmitter = require('events').EventEmitter;

var eventMap = {
  add: 'added',
  unlink: 'deleted',
  change: 'changed'
}

module.exports = function(glob, opts, cb) {
  var out = new EventEmitter();

  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  opts = opts || {};

  if (opts.ignoreInitial == null) {
    opts.ignoreInitial = true;
  }

  var watcher = chokidar.watch(glob, opts);

  var nomatch = true;
  var filteredCbs = [];

  watcher.on('all', function(evt, path, stats){
    // convert from chokidar event names to glob-watcher's original names
    evt = eventMap[evt];
    if (!evt) {
      return;
    }
    nomatch = false;
    var outEvt = {
      type: evt,
      path: path
    };
    if (stats) {
      outEvt.stats = stats;
    }
    out.emit('change', outEvt);
    filteredCbs.forEach(function(pair) {
      if (pair.filter(path)) {
        pair.cb();
      }
    });
    cb && cb();
  });
  watcher.on('ready', function() {
    if (nomatch) {
      out.emit('nomatch');
    }
    out.emit('ready');
  });
  watcher.on('error', out.emit.bind(out, 'error'));

  out.add = function(glob, cb){
    if (cb) {
      filteredCbs.push({
        filter: anymatch(glob),
        cb: cb
      });
    }
    watcher.add(glob);
    return watcher;
  };
  out.end = function() {
    watcher.close();
    out.emit('end');
    return watcher;
  }
  out.remove = watcher.unwatch.bind(watcher);
  out._watcher = watcher;

  return out;
};
