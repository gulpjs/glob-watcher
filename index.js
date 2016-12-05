'use strict';

var chokidar = require('chokidar');
var debounce = require('lodash.debounce');
var asyncDone = require('async-done');
var assignWith = require('lodash.assignwith');

function assignNullish(objValue, srcValue) {
  return (srcValue == null ? objValue : srcValue);
}

var defaults = {
  ignoreInitial: true,
  delay: 200,
  queue: true,
};

function watch(glob, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  var opt = assignWith({}, defaults, options, assignNullish);

  if (!opt.events) {
    opt.events = ['add', 'change', 'unlink'];
  }

  if (!(opt.events instanceof Array)) {
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

  if (typeof cb === 'function') {
    var fn = debounce(onChange, opt.delay, opt);

    opt.events.forEach(function watchEvent(eventName) {
      watcher.on(eventName, fn);
    });
  }

  return watcher;
}

module.exports = watch;
