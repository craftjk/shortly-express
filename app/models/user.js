var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  initialize: function(model,attrs,cb){
    var context = this;

    if (cb) {
      bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(model.password, salt, null, function(err, hash) {
          if (err) { throw err; }
          context.set('password', hash);
          cb(context);
        });
      });
    }
  }

});

module.exports = User;
