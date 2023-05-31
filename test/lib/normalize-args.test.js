'use strict';

var expect = require('expect');
var normalizeArgs = require('../../lib/normalize-args');

describe('lib/normalize-args', function () {
  it('should normalize glob to an array', function (done) {
    var opts0 = {
      delay: 500,
      events: ['all'],
      ignored: ['.*.txt'],
      ignoreInitial: false,
      queue: false,
      persistent: true,
    };
    var cb0 = function () {};

    normalizeArgs('*.txt', opts0, cb0, function (glob, opts, cb) {
      expect(Array.isArray(glob)).toBeTruthy();
      expect(opts).not.toBe(opts0);
      expect(opts).toEqual(opts0);
      expect(cb).toBe(cb0);
      done();
    });
  });

  it('should complement options with default options', function (done) {
    var glob0 = ['*.txt'];
    var cb0 = function () {};

    normalizeArgs(glob0, {}, cb0, function (glob, opts, cb) {
      expect(glob).not.toBe(glob0);
      expect(glob).toEqual(glob0);
      expect(opts).toEqual({
        delay: 200,
        events: ['add', 'change', 'unlink'],
        ignored: [],
        ignoreInitial: true,
        queue: true,
      });
      expect(cb).toBe(cb0);
      done();
    });
  });

  it('should normalize options.events to an array', function (done) {
    var glob0 = ['*.txt'];
    var opts0 = {
      events: 'all',
    };
    var cb0 = function () {};

    normalizeArgs(glob0, opts0, cb0, function (glob, opts, cb) {
      expect(glob).not.toBe(glob0);
      expect(glob).toEqual(glob0);
      expect(opts).toEqual({
        delay: 200,
        events: ['all'],
        ignored: [],
        ignoreInitial: true,
        queue: true,
      });
      expect(cb).toBe(cb0);
      done();
    });
  });

  it('should change 2nd arg to cb if 2nd arg is a function', function (done) {
    var glob0 = ['*.txt'];
    var cb0 = function () {};
    normalizeArgs(glob0, cb0, undefined, function (glob, opts, cb) {
      expect(glob).not.toBe(glob0);
      expect(glob).toEqual(glob0);
      expect(opts).toEqual({
        delay: 200,
        events: ['add', 'change', 'unlink'],
        ignored: [],
        ignoreInitial: true,
        queue: true,
      });
      expect(cb).toBe(cb0);
      done();
    });
  });
});
