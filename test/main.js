var watch = require('../');
var should = require('should');
var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');

require('mocha');

// timeout is 100ms by default on gaze
// so any file modifications are done on this interval
var timeout = 100;

describe('glob-watcher', function() {
  it('should return a valid file struct via EE', function(done) {
    var expectedName = path.join(__dirname, './fixtures/stuff/temp.coffee');
    var fname = path.join(__dirname, './fixtures/**/temp.coffee');
    mkdirp.sync(path.dirname(expectedName));
    fs.writeFileSync(expectedName, 'testing');

    var watcher = watch(fname);
    watcher.once('change', function(evt) {
      should.exist(evt);
      should.exist(evt.path);
      should.exist(evt.type);
      evt.type.should.equal('changed');
      evt.path.should.equal(expectedName);
      watcher.end();
    });
    watcher.once('end', function(){
      rimraf.sync(expectedName);
      done();
    });
    setTimeout(function(){
      fs.writeFileSync(expectedName, 'test test');
    }, timeout);
  });

  it('should emit nomatch via EE', function(done) {
    var fname = path.join(__dirname, './doesnt_exist_lol/temp.coffee');

    var watcher = watch(fname);
    watcher.once('nomatch', function() {
      done();
    });
  });

  it('should not pass any args via callback', function(done) {
    var expectedName = path.join(__dirname, './fixtures/stuff/test.coffee');
    var fname = path.join(__dirname, './fixtures/**/test.coffee');
    mkdirp.sync(path.dirname(expectedName));
    fs.writeFileSync(expectedName, 'testing');

    var watcher = watch(fname, function() {
      arguments.length.should.equal(0);
      watcher.end();
    });

    watcher.once('end', function(){
      rimraf.sync(expectedName);
      done();
    });
    setTimeout(function(){
      fs.writeFileSync(expectedName, 'test test');
    }, timeout);
  });

  it('should call the callback registered with `add`', function(done) {
    var expectedName = path.join(__dirname, './fixtures/stuff/test.coffee');
    var fname = path.join(__dirname, './fixtures/**/test.coffee');
    mkdirp.sync(path.dirname(expectedName));
    fs.writeFileSync(expectedName, 'testing');

    var watcher = watch();
    watcher.add(fname, function() {
      arguments.length.should.equal(0);
      watcher.end();
    });

    watcher.once('end', function(){
      rimraf.sync(expectedName);
      done();
    });
    setTimeout(function(){
      fs.writeFileSync(expectedName, 'test test');
    }, timeout);
  });

  it('should not call a callback when filepath removed with `remove`', function(done) {
    var expectedName = path.join(__dirname, './fixtures/stuff/test.coffee');
    var fname = path.join(__dirname, './fixtures/**/test.coffee');
    mkdirp.sync(path.dirname(expectedName));
    fs.writeFileSync(expectedName, 'testing');

    var watcher = watch();
    watcher.add(fname, function() {
      // if we get here, that's bad and should fail
      true.should.equal(false);
      watcher.end();
    });
    watcher.remove(expectedName);

    setTimeout(function(){
      fs.writeFileSync(expectedName, 'test test');
    }, timeout);
    setTimeout(function(){
      rimraf.sync(expectedName);
      done();
    }, timeout * 3);
  });

  it('should not return a non-matching file struct via callback', function(done) {
    var expectedName = path.join(__dirname, './fixtures/test123.coffee');
    var fname = path.join(__dirname, './fixtures/**/test.coffee');
    mkdirp.sync(path.dirname(expectedName));
    fs.writeFileSync(expectedName, 'testing');

    var watcher = watch(fname, function(evt) {
      throw new Error('Should not have been called! '+evt.path);
    });

    setTimeout(function(){
      fs.writeFileSync(expectedName, 'test test');
    }, timeout);

    setTimeout(function(){
      rimraf.sync(expectedName);
      done();
    }, timeout * 2);
  });
});
