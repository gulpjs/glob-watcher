'use strict';

var chokidar = require('chokidar');
var debounce = require('lodash.debounce');
var asyncDone = require('async-done');
var assignWith = require('lodash.assignwith');

function assignNullish(objValue, srcValue) {
  return (srcValue == null ? objValue : srcValue);
}

var defaults = {
  delay: 200,
  events: ['add', 'change', 'unlink'],
  ignoreInitial: true,
  queue: true,
};

function watch(glob, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  var opt = assignWith({}, defaults, options, assignNullish);

  if (!Array.isArray(opt.events)) {
    opt.events = [opt.events];
  }

  var queued = false;
  var running = false;

  var watcher = chokidar.watch(glob, opt);

  function runComplete(err) {
    running = false;

    if (err) {
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
    fn = debounce(onChange, opt.delay, opt);
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
