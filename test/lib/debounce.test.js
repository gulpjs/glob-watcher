'use strict';

var expect = require('expect');
var sinon = require('sinon');
var debounce = require('../../lib/debounce');

describe('lib/debounce', function () {
  it('should call an original function with specified delay', function (done) {
    expect.assertions(1);

    var executed = false;
    var fn = debounce(function () {
      executed = true;
    }, 10);

    fn();

    expect(executed).toBeFalsy();

    setTimeout(function () {
      expect(executed).toBeTruthy();
      done();
    }, 11);
  });

  it('should extend delay against multiple calls', function (done) {
    expect.assertions(1);

    var fn = debounce(function (a) {
      expect(a).toBe(3);
      done();
    }, 50);

    fn(1);
    fn(2);

    setTimeout(function () {
      fn(3);
    }, 3);
  });

  it("should extends delay if a preceding call doesn't run yet", function (done) {
    expect.assertions(1);

    var fn = debounce(function (a) {
      expect(a).toBe(3);
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

  it('should run if a preceding call already run', function (done) {
    expect.assertions(2);

    var spy = sinon.spy(function (a) {
      switch (spy.callCount) {
        case 1:
          expect(a).toBe(2);
          break;
        case 2:
          expect(a).toBe(3);
          done();
          break;
        default:
          throw new Error();
      }
    });
    var fn = debounce(spy, 6);

    fn(1);

    setTimeout(function () {
      fn(2);

      setTimeout(function () {
        fn(3);
      }, 10);
    }, 3);
  });
});
