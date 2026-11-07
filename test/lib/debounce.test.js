"use strict";

var { describe, it } = require("node:test");

var debounce = require("../../lib/debounce");

describe("lib/debounce", function () {
  it("should call an original function with specified delay", function (t, done) {
    t.plan(2);

    var executed = false;
    var fn = debounce(function () {
      executed = true;
    }, 10);

    fn();

    t.assert.ok(!executed);

    setTimeout(function () {
      t.assert.ok(executed);
      done();
    }, 11);
  });

  it("should extend delay against multiple calls", function (t, done) {
    t.plan(1);

    var fn = debounce(function (a) {
      t.assert.strictEqual(a, 3);
      done();
    }, 50);

    fn(1);
    fn(2);

    setTimeout(function () {
      fn(3);
    }, 3);
  });

  it("should extends delay if a preceding call doesn't run yet", function (t, done) {
    t.plan(1);

    var fn = debounce(function (a) {
      t.assert.strictEqual(a, 3);
      done();
    }, 10);

    fn(1);

    setTimeout(function () {
      fn(2);

      setTimeout(function () {
        fn(3);
      }, 5);
    }, 5);
  });

  it("should run if a preceding call already run", function (t, done) {
    t.plan(2);

    let callCount = 0;

    function callback(a) {
      callCount++;

      switch (callCount) {
        case 1:
          t.assert.strictEqual(a, 2);
          break;
        case 2:
          t.assert.strictEqual(a, 3);
          done();
          break;
        default:
          t.assert.fail("should not be reached");
      }
    }
    var fn = debounce(callback, 6);

    fn(1);

    setTimeout(function () {
      fn(2);

      setTimeout(function () {
        fn(3);
      }, 10);
    }, 3);
  });
});
