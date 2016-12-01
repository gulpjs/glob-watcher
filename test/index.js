'use strict';

var fs = require('fs');
var path = require('path');

var del = require('del');
var expect = require('expect');
var through = require('through2');

var watch = require('../');

// Default delay on debounce
var timeout = 200;

describe('glob-watcher', function() {

  var watcher;

  var outDir = path.join(__dirname, './fixtures/');
  var outFile1 = path.join(outDir, 'changed.js');
  var outFile2 = path.join(outDir, 'added.js');
  var outGlob = path.join(outDir, './**/*.js');

  function changeFile() {
    fs.writeFileSync(outFile1, 'hello changed');
  }

  function addFile() {
    fs.writeFileSync(outFile2, 'hello added');
  }

  beforeEach(function(cb) {
    fs.mkdirSync(outDir);
    fs.writeFileSync(outFile1, 'hello world');
    cb();
  });

  afterEach(function() {
    if (watcher) {
      watcher.close();
    }
    return del(outDir);
  });

  after(function() {
    return del(outDir);
  });

  it('only requires a glob and returns watcher', function(done) {
    watcher = watch(outGlob);

    watcher.once('change', function(path) {
      expect(path).toEqual(outFile1);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);
  });

  it('picks up added files', function(done) {
    watcher = watch(outGlob);

    watcher.once('add', function(path) {
      expect(path).toEqual(outFile2);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', addFile);
  });

  it('accepts a callback & calls when file is changed', function(done) {
    watcher = watch(outGlob, function(cb) {
      cb();
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);
  });

  it('accepts a callback & calls when file is added', function(done) {
    watcher = watch(outGlob, function(cb) {
      cb();
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', addFile);
  });

  it('waits for completion is signaled before running again', function(done) {
    var runs = 0;

    watcher = watch(outGlob, function(cb) {
      runs++;
      if (runs === 1) {
        setTimeout(function() {
          expect(runs).toEqual(1);
          cb();
        }, timeout * 3);
      }
      if (runs === 2) {
        cb();
        done();
      }
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', function() {
      changeFile();
      // Fire after double the delay
      setTimeout(changeFile, timeout * 2);
    });
  });

  // It can signal completion with anything async-done supports
  // Just wanted to have a smoke test for streams
  it('can signal completion with a stream', function(done) {
    var runs = 0;

    watcher = watch(outGlob, function(cb) {
      runs++;
      if (runs === 1) {
        var stream = through();
        setTimeout(function() {
          expect(runs).toEqual(1);
          stream.end();
        }, timeout * 3);
        return stream;
      }
      if (runs === 2) {
        cb();
        done();
      }
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', function() {
      changeFile();
      // Fire after double the delay
      setTimeout(changeFile, timeout * 2);
    });
  });

  it('emits an error if one occurs in the callback', function(done) {
    var expectedError = new Error('boom');

    watcher = watch(outGlob, function(cb) {
      cb(expectedError);
    });

    watcher.on('error', function(err) {
      expect(err).toEqual(expectedError);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);
  });

  it('allows the user to disable queueing', function(done) {
    var runs = 0;

    watcher = watch(outGlob, { queue: false }, function(cb) {
      runs++;
      setTimeout(function() {
        // Expect 1 because run 2 is never queued
        expect(runs).toEqual(1);
        cb();
        done();
      }, timeout * 3);
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', function() {
      changeFile();
      // This will never trigger a call because queueing is disabled
      setTimeout(changeFile, timeout * 2);
    });
  });

  it('allows the user to adjust delay', function(done) {
    var runs = 0;

    watcher = watch(outGlob, { delay: (timeout / 2) }, function(cb) {
      runs++;
      if (runs === 1) {
        setTimeout(function() {
          expect(runs).toEqual(1);
          cb();
        }, timeout * 3);
      }
      if (runs === 2) {
        expect(runs).toEqual(2);
        cb();
        done();
      }
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', function() {
      changeFile();
      // This will queue because delay is halved
      setTimeout(changeFile, timeout);
    });
  });

  it('passes options to chokidar', function(done) {
    // Callback is called while chokidar is discovering file paths
    // if ignoreInitial is explicitly set to false and passed to chokidar
    watcher = watch(outGlob, { ignoreInitial: false }, function(cb) {
      cb();
      done();
    });
  });

  it('passes options to lodash.debounce', function(done) {
    var runs = 0;

    watcher = watch(outGlob, { leading: true }, function(cb) {
      runs++;
      if (runs === 1) {
        setTimeout(function() {
          expect(runs).toEqual(1);
          cb();
        }, timeout * 3);
      }
      if (runs === 2) {
        expect(runs).toEqual(2);
        cb();
        done();
      }
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', function() {
      changeFile();
      // Fires on the leading edge on the debounce
      setTimeout(changeFile, timeout);
    });
  });

  it('does not override default values with null values', function(done) {
    watcher = watch(outGlob, { ignoreInitial: null }, function(cb) {
      cb();
      done();
    });

    // We default `ignoreInitial` to true and it isn't overwritten by null
    // So wait for `on('ready')`
    watcher.on('ready', changeFile);
  });

  it('watches exactly the given event', function(done) {
    var spy = expect.createSpy()
    .andCall(function(cb) {
      cb();
      spy.andThrow(new Error('`Add` handler called for `change` event'));
      setTimeout(done, 500);
      changeFile();
    });

    watcher = watch(outGlob, { events: 'add' }, spy);

    watcher.on('ready', addFile);
  });

  it('accepts multiple events to watch', function(done) {
    var spy = expect.createSpy()
    .andThrow(new Error('`Add`/`Unlink` handler called for `change` event'));

    watcher = watch(outGlob, { events: ['add', 'unlink'] }, spy);

    watcher.on('ready', function() {
      changeFile();
      setTimeout(done, 500);
    });
  });
});
