'use strict';

var chokidar = require('chokidar');
var debounce = require('just-debounce');
var asyncDone = require('async-done');
var defaults = require('object.defaults/immutable');
var isNegatedGlob = require('is-negated-glob');
var anymatch = require('anymatch');

var defaultOpts = {
  delay: 200,
  events: ['add', 'change', 'unlink'],
  ignoreInitial: true,
  queue: true,
};

function listenerCount(ee, evtName) {
  if (typeof ee.listenerCount === 'function') {
    return ee.listenerCount(evtName);
  }

  return ee.listeners(evtName).length;
}

function hasErrorListener(ee) {
  return listenerCount(ee, 'error') !== 0;
}

function watch(glob, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  var opt = defaults(options, defaultOpts);

  if (!Array.isArray(opt.events)) {
    opt.events = [opt.events];
  }

  if (!Array.isArray(glob)) {
    glob = [glob];
  }

  var queued = false;
  var running = false;

  var positives = [];
  var negatives = [];

  glob.forEach(sortGlobs);

  function sortGlobs(globString, index) {
    if (typeof globString !== 'string') {
      throw new Error('Invalid glob at index ' + index);
    }

    var result = isNegatedGlob(globString);

    var posResult = result.negated ? null : {
      index: index,
      glob: result.pattern,
    };

    var negResult = result.negated ? {
      index: index,
      glob: result.pattern,
    } : null;

    positives.push(posResult);
    negatives.push(negResult);
  }

  function shouldBeIgnored(path) {
    var positiveGlobs = positives.reverse()
      .filter(notNull)
      .map(getGlob);

    var negativeGlobs = negatives.reverse()
      .filter(notNull)
      .map(getGlob);

    var positiveMatch = anymatch(positiveGlobs, path, true);
    var negativeMatch = anymatch(negativeGlobs, path, true);

    return negativeMatch > positiveMatch;
  }

  var toWatch = positives
  .filter(notNull)
  .map(getGlob);

  opt.ignored = shouldBeIgnored;
  var watcher = chokidar.watch(toWatch, opt);

  function notNull(val) {
    return val != null;
  }

  function getGlob(val) {
    return val.glob;
  }

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
