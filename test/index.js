"use strict";

var os = require("node:os");
var fs = require("node:fs");
var path = require("node:path");
var assert = require("node:assert");
var { after, afterEach, beforeEach, describe, it } = require("node:test");

var rimraf = require("rimraf");
var through = require("through2");
var normalizePath = require("normalize-path");

var watch = require("../");

// Default delay on debounce
var timeout = 200;
var isWindows = os.platform() === "win32";

describe("glob-watcher", function () {
  var watcher;

  var outDir = path.join(__dirname, "./fixtures/");
  var outFile1 = path.join(outDir, "changed.js");
  var outFile2 = path.join(outDir, "added.js");
  var globPattern = "**/*.js";
  var outGlob = path.join(outDir, globPattern);
  var singleAdd = path.join(outDir, "changed.js");
  var ignoreGlob = "!" + singleAdd;

  function changeFile() {
    fs.writeFileSync(outFile1, "hello changed");
  }

  function addFile() {
    fs.writeFileSync(outFile2, "hello added");
  }

  beforeEach(function () {
    fs.mkdirSync(outDir);
    fs.writeFileSync(outFile1, "hello world");
  });

  afterEach(function (t, cb) {
    if (watcher) {
      watcher.close();
    }
    rimraf(outDir, cb);
  });

  after(function (t, cb) {
    rimraf(outDir, cb);
  });

  it("only requires a glob and returns watcher", function (t, done) {
    watcher = watch(outGlob);

    watcher.once("change", function (filepath) {
      assert.deepStrictEqual(filepath, outFile1);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);
  });

  it("picks up added files", function (t, done) {
    watcher = watch(outGlob);

    watcher.once("add", function (filepath) {
      assert.deepStrictEqual(filepath, outFile2);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", addFile);
  });

  it("works with OS-specific cwd", function (t, done) {
    watcher = watch("./fixtures/" + globPattern, { cwd: __dirname });

    watcher.once("change", function (filepath) {
      // Uses path.join here because the resulting path is OS-specific
      assert.deepStrictEqual(filepath, path.join("fixtures", "changed.js"));
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);
  });

  it("accepts a callback & calls when file is changed", function (t, done) {
    watcher = watch(outGlob, function (cb) {
      cb();
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);
  });

  it("accepts a callback & calls when file is added", function (t, done) {
    watcher = watch(outGlob, function (cb) {
      cb();
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", addFile);
  });

  it("waits for completion before running again", function (t, done) {
    var spy = t.mock.fn((cb) => cb());
    spy.mock.mockImplementationOnce((cb) => {
      setTimeout(function () {
        cb();
      }, timeout * 3);
    });

    watcher = watch(outGlob, spy);

    watcher.on("ready", function () {
      changeFile();
      setTimeout(changeFile, timeout * 2);
    });

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 2);
      done();
    }, 1000);
  });

  // It can signal completion with anything async-done supports
  // Just wanted to have a smoke test for streams
  it("can signal completion with a stream", function (t, done) {
    var spy = t.mock.fn((cb) => cb());
    spy.mock.mockImplementationOnce(() => {
      var stream = through();
      setTimeout(function () {
        stream.end();
      }, timeout * 3);
      return stream;
    });

    watcher = watch(outGlob, spy);

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", function () {
      changeFile();
      // Fire after double the delay
      setTimeout(changeFile, timeout * 2);
    });

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 2);
      done();
    }, 1000);
  });

  it("emits an error if one occurs in the callback and handler attached", function (t, done) {
    var expectedError = new Error("boom");

    watcher = watch(outGlob, function (cb) {
      cb(expectedError);
    });

    watcher.on("error", function (err) {
      assert.deepStrictEqual(err, expectedError);
      done();
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);
  });

  it("does not emit an error (and crash) when no handlers attached", function (t, done) {
    var expectedError = new Error("boom");

    watcher = watch(outGlob, function (cb) {
      cb(expectedError);
      setTimeout(done, timeout * 3);
    });

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);
  });

  it("allows the user to disable queueing", function (t, done) {
    var spy = t.mock.fn((cb) => {
      setTimeout(function () {
        cb();
      }, timeout * 3);
    });

    watcher = watch(outGlob, { queue: false }, spy);

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", function () {
      changeFile();
      // This will never trigger a call because queueing is disabled
      setTimeout(changeFile, timeout * 2);
    });

    setTimeout(function () {
      // Expect 1 because run 2 is never queued
      assert.strictEqual(spy.mock.callCount(), 1);
      done();
    }, 1000);
  });

  it("allows the user to adjust delay", function (t, done) {
    var spy = t.mock.fn((cb) => cb());
    spy.mock.mockImplementationOnce((cb) => {
      setTimeout(function () {
        cb();
      }, timeout * 3);
    });

    watcher = watch(outGlob, { delay: timeout / 2 }, spy);

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", function () {
      changeFile();
      // This will queue because delay is halved
      setTimeout(changeFile, timeout);
    });

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 2);
      done();
    }, 1000);
  });

  it("passes options to chokidar", function (t, done) {
    // Callback is called while chokidar is discovering file paths
    // if ignoreInitial is explicitly set to false and passed to chokidar
    watcher = watch(outGlob, { ignoreInitial: false }, function (cb) {
      cb();
      done();
    });
  });

  it("does not override default values with null values", function (t, done) {
    watcher = watch(outGlob, { ignoreInitial: null }, function (cb) {
      cb();
      done();
    });

    // We default `ignoreInitial` to true and it isn't overwritten by null
    // So wait for `on('ready')`
    watcher.on("ready", changeFile);
  });

  it("watches exactly the given event", function (t, done) {
    var spy = t.mock.fn((cb) => {
      cb();
      changeFile();
    });

    watcher = watch(outGlob, { events: "add" }, spy);

    watcher.on("ready", addFile);

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 1);
      done();
    }, 1000);
  });

  it("accepts multiple events to watch", function (t, done) {
    var spy = t.mock.fn((cb) => cb());

    watcher = watch(outGlob, { events: ["add", "change"] }, spy);

    watcher.on("ready", addFile);
    watcher.on("add", function () {
      setTimeout(changeFile, 500);
    });

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 2);
      done();
    }, 1000);
  });

  it(
    "can ignore a glob after it has been added",
    // Chokidar doesn't normalize absolute Windows globs correctly so we can't test this
    { skip: isWindows },
    function (t, done) {
      watcher = watch([outGlob, ignoreGlob]);

      var spy = t.mock.fn(() => {
        assert.fail("should never be called");
      });
      watcher.once("change", spy);

      // We default `ignoreInitial` to true, so always wait for `on('ready')`
      watcher.on("ready", changeFile);

      setTimeout(function () {
        assert.strictEqual(spy.mock.callCount(), 0);
        done();
      }, 1000);
    },
  );

  it("can ignore a relative glob after it has been added", function (t, done) {
    watcher = watch(["fixtures/**/*.js", "!fixtures/changed.js"], {
      cwd: __dirname,
    });

    var spy = t.mock.fn(() => {
      assert.fail("should never be called");
    });
    watcher.once("change", spy);

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 0);
      done();
    }, 1000);
  });

  it(
    "can re-add a glob after it has been negated",
    // Chokidar doesn't normalize absolute Windows globs correctly so we can't test this
    { skip: isWindows },
    function (t, done) {
      watcher = watch([outGlob, ignoreGlob, singleAdd]);

      var spy = t.mock.fn(() => {});

      watcher.once("change", spy);

      // We default `ignoreInitial` to true, so always wait for `on('ready')`
      watcher.on("ready", changeFile);

      setTimeout(function () {
        assert.strictEqual(spy.mock.callCount(), 1);
        assert.strictEqual(spy.mock.calls[0].arguments[0], singleAdd);
        done();
      }, 1000);
    },
  );

  it(
    "can re-add a relative glob after it has been negated",
    // Chokidar doesn't handle Windows globs correctly so we can't test this
    { skip: isWindows },
    function (t, done) {
      watcher = watch(
        ["fixtures/**/*.js", "!fixtures/changed.js", "fixtures/changed.js"],
        { cwd: __dirname },
      );

      var spy = t.mock.fn(() => {});

      watcher.once("change", spy);

      // We default `ignoreInitial` to true, so always wait for `on('ready')`
      watcher.on("ready", changeFile);

      setTimeout(function () {
        assert.strictEqual(spy.mock.callCount(), 1);
        assert.strictEqual(
          spy.mock.calls[0].arguments[0],
          "fixtures/changed.js",
        );
        done();
      }, 1000);
    },
  );

  it(
    "can re-add a glob after it has been negated (unix style absolute paths)",
    // Chokidar doesn't normalize absolute Windows globs correctly so we can't test this
    { skip: isWindows },
    function (t, done) {
      watcher = watch([
        normalizePath(outGlob),
        normalizePath(ignoreGlob),
        normalizePath(singleAdd),
      ]);

      var spy = t.mock.fn(() => {});

      watcher.once("change", spy);

      // We default `ignoreInitial` to true, so always wait for `on('ready')`
      watcher.on("ready", changeFile);

      setTimeout(function () {
        assert.strictEqual(spy.mock.callCount(), 1);
        assert.strictEqual(spy.mock.calls[0].arguments[0], singleAdd);
        done();
      }, 1000);
    },
  );

  it("does not mutate the globs array", function (t, done) {
    var globs = [outGlob, ignoreGlob, singleAdd];
    watcher = watch(globs);

    assert.strictEqual(globs[0], outGlob);
    assert.strictEqual(globs[1], ignoreGlob);
    assert.strictEqual(globs[2], singleAdd);

    done();
  });

  it("passes ignores through to chokidar", function (t, done) {
    var ignored = [singleAdd];
    watcher = watch(outGlob, {
      ignored: ignored,
    });

    var spy = t.mock.fn(() => {
      assert.fail("should never be called");
    });
    watcher.once("change", spy);

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);

    // Just test the non-mutation in this test
    assert.deepStrictEqual(ignored.length, 1);

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 0);
      done();
    }, 1500);
  });

  // https://github.com/gulpjs/glob-watcher/issues/46
  it("ignoring globs also works with `cwd` option", function (t, done) {
    // Note: In issue #46, the submitted specified a relative path, but Chokidar
    // requires it to be absolute path or else the resolved globs become incorrect
    watcher = watch(["fixtures/**", "!fixtures/*.js"], { cwd: __dirname });

    var spy = t.mock.fn(() => {
      assert.fail("should never be called");
    });
    watcher.once("change", spy);

    // We default `ignoreInitial` to true, so always wait for `on('ready')`
    watcher.on("ready", changeFile);

    setTimeout(function () {
      assert.strictEqual(spy.mock.callCount(), 0);
      done();
    }, 1500);
  });
});
