'use strict';

var chokidar = require('chokidar');
var asyncDone = require('async-done');
var debounce = require('./lib/debounce');

var defaultOpts = {
  delay: 200,
  events: ['add', 'change', 'unlink'],
  ignored: [],
  ignoreInitial: true,
  queue: true,
};

function listenerCount(ee, evtName) {
  /* istanbul ignore else */
  if (typeof ee.listenerCount === 'function') {
    return ee.listenerCount(evtName);
  }

  /* istanbul ignore next */
  return ee.listeners(evtName).length;
}

function hasErrorListener(ee) {
  return listenerCount(ee, 'error') !== 0;
}

function exists(val) {
  return val != null;
}

function watch(glob, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  var opt = Object.assign({}, defaultOpts, options);

  if (!Array.isArray(opt.events)) {
    opt.events = [opt.events];
  }

  if (Array.isArray(glob)) {
    // We slice so we don't mutate the passed globs array
    glob = glob.slice();
  } else {
    glob = [glob];
  }

  var queued = false;
  var running = false;

  var watcher = chokidar.watch(glob, opt);

  function runComplete(err) {
    running = false;

    if (err && hasErrorListener(watcher)) {
      watcher.emit('error', err);
    }

    // If we have a run queued, start onChange again
    if (queued) {
      queued = false;
      onChange();
    }
  }

  function onChange() {
    if (running) {
      if (opt.queue) {
        queued = true;
      }
      return;
    }

    running = true;
    asyncDone(cb, runComplete);
  }

  var fn;
  if (typeof cb === 'function') {
    fn = debounce(onChange, opt.delay);
  }

  function watchEvent(eventName) {
    watcher.on(eventName, fn);
  }

  if (fn) {
    opt.events.forEach(watchEvent);
  }

  return watcher;
}

module.exports = watch;
