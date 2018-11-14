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

  var queued = false;
  var running = false;

  var positives = [];
  var negatives = [];

  if (!Array.isArray(glob)) {
    glob = [glob];
  }

  glob.forEach(sortGlobs);

  function sortGlobs(globString, index) {
    if (typeof globString !== 'string') {
      throw new Error('Invalid glob at index ' + index);
    }

    var result = isNegatedGlob(globString);
    var globArray = result.negated ? negatives : positives;

    globArray.push({
      index: index,
      glob: result.pattern,
    });
  }

  function shouldBeIgnored(path) {
    for (var x = 0; x < negatives.length; x++) {
      var negMatcher = anymatch([negatives[x].glob]);
      if (negMatcher(path)) {
        var prevNegationIndex = -1;
        var haveEncounteredPos = false;
        for (var y = x - 1; y >= 0; y--) {
          var negGlob = isNegatedGlob(glob[y]);
          if (negGlob.negated && haveEncounteredPos) {
            prevNegationIndex = y;
            break;
          } else if (!negGlob.negated) {
            haveEncounteredPos = true;
          }
        }

        var positivesToCheck = positives.filter(function(positive) {
          return (positive.index < negatives[x].index && positive.index > prevNegationIndex);
        });

        var posMatcher = anymatch(positivesToCheck);
        return posMatcher(path);
      }
    }

  }

  opt.ignored = shouldBeIgnored;

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
