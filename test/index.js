'use strict';

var fs = require('fs');
var path = require('path');

var expect = require('expect');
var rimraf = require('rimraf');
var through = require('through2');
var normalizePath = require('normalize-path');

var watch = require('../');

// Default delay on debounce
var timeout = 200;

describe('glob-watcher', function() {

  var watcher;

  var outDir = path.join(__dirname, './fixtures/');
  var outFile1 = path.join(outDir, 'changed.js');
  var outFile2 = path.join(outDir, 'added.js');
  var globPattern = '**/*.js';
  var outGlob = normalizePath(path.join(outDir, globPattern));
  var singleAdd = normalizePath(path.join(outDir, 'changed.js'));
  var ignoreGlob = '!' + singleAdd;

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

  afterEach(function(cb) {
    if (watcher) {
      watcher.close();
    }
    rimraf(outDir, cb);
  });

  after(function(cb) {
    rimraf(outDir, cb);
  });

  it('only requires a glob and returns watcher', function(done) {
    watcher = watch(outGlob);

    watcher.once('change', function(filepath) {
      expect(filepath).toEqual(outFile1);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);
  });

  it('picks up added files', function(done) {
    watcher = watch(outGlob);

    watcher.once('add', function(filepath) {
      expect(filepath).toEqual(outFile2);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', addFile);
  });

  it('works with OS-specific cwd', function(done) {
    watcher = watch('./fixtures/' + globPattern, { cwd: __dirname });

    watcher.once('change', function(filepath) {
      // Uses path.join here because the resulting path is OS-specific
      expect(filepath).toEqual(path.join('fixtures', 'changed.js'));
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);
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

  it('emits an error if one occurs in the callback and handler attached', function(done) {
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

  it('does not emit an error (and crash) when no handlers attached', function(done) {
    var expectedError = new Error('boom');

    watcher = watch(outGlob, function(cb) {
      cb(expectedError);
      setTimeout(done, timeout * 3);
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

  it('can ignore a glob after it has been added', function(done) {
    watcher = watch([outGlob, ignoreGlob]);

    watcher.once('change', function(filepath) {
      // It should never reach here
      expect(filepath).toNotExist();
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);

    setTimeout(done, 1500);
  });

  it('can re-add a glob after it has been negated', function(done) {
    watcher = watch([outGlob, ignoreGlob, singleAdd]);

    watcher.once('change', function(filepath) {
      expect(filepath).toEqual(singleAdd);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);
  });

  it('does not mutate the globs array', function(done) {
    var globs = [outGlob, ignoreGlob, singleAdd];
    watcher = watch(globs);

    expect(globs[0]).toEqual(outGlob);
    expect(globs[1]).toEqual(ignoreGlob);
    expect(globs[2]).toEqual(singleAdd);

    done();
  });

  it('passes ignores through to chokidar', function(done) {
    var ignored = [singleAdd];
    watcher = watch(outGlob, {
      ignored: ignored,
    });

    watcher.once('change', function(filepath) {
      // It should never reach here
      expect(filepath).toNotExist();
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);

    // Just test the non-mutation in this test
    expect(ignored.length).toEqual(1);

    setTimeout(done, 1500);
  });

  // https://github.com/gulpjs/glob-watcher/issues/46
  it('ignoring globs also works with `cwd` option', function(done) {
    watcher = watch(['fixtures/**', '!fixtures/*.js'], { cwd: 'test' });

    watcher.once('change', function(filepath) {
      // It should never reach here
      expect(filepath).toNotExist();
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on('ready', changeFile);

    setTimeout(done, 1500);
  });
});
