"use strict";

var assert = require("node:assert");
var { describe, it } = require("node:test");

var normalizeArgs = require("../../lib/normalize-args");

describe("lib/normalize-args", function () {
  it("should normalize glob to an array", function (t, done) {
    var opts0 = {
      delay: 500,
      events: ["all"],
      ignored: [".*.txt"],
      ignoreInitial: false,
      queue: false,
      persistent: true,
    };
    var cb0 = function () {};

    normalizeArgs("*.txt", opts0, cb0, function (glob, opts, cb) {
      assert.ok(Array.isArray(glob));
      assert.notStrictEqual(opts, opts0);
      assert.deepStrictEqual(opts, opts0);
      assert.strictEqual(cb, cb0);
      done();
    });
  });

  it("should complement options with default options", function (t, done) {
    var glob0 = ["*.txt"];
    var cb0 = function () {};

    normalizeArgs(glob0, {}, cb0, function (glob, opts, cb) {
      assert.notStrictEqual(glob, glob0);
      assert.deepStrictEqual(glob, glob0);
      assert.deepStrictEqual(opts, {
        delay: 200,
        events: ["add", "change", "unlink"],
        ignored: [],
        ignoreInitial: true,
        queue: true,
      });
      assert.strictEqual(cb, cb0);
      done();
    });
  });

  it("should normalize options.events to an array", function (t, done) {
    var glob0 = ["*.txt"];
    var opts0 = {
      events: "all",
    };
    var cb0 = function () {};

    normalizeArgs(glob0, opts0, cb0, function (glob, opts, cb) {
      assert.notStrictEqual(glob, glob0);
      assert.deepStrictEqual(glob, glob0);
      assert.deepStrictEqual(opts, {
        delay: 200,
        events: ["all"],
        ignored: [],
        ignoreInitial: true,
        queue: true,
      });
      assert.strictEqual(cb, cb0);
      done();
    });
  });

  it("should change 2nd arg to cb if 2nd arg is a function", function (t, done) {
    var glob0 = ["*.txt"];
    var cb0 = function () {};
    normalizeArgs(glob0, cb0, undefined, function (glob, opts, cb) {
      assert.notStrictEqual(glob, glob0);
      assert.deepStrictEqual(glob, glob0);
      assert.deepStrictEqual(opts, {
        delay: 200,
        events: ["add", "change", "unlink"],
        ignored: [],
        ignoreInitial: true,
        queue: true,
      });
      assert.strictEqual(cb, cb0);
      done();
    });
  });
});
