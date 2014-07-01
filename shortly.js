var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var passport = require('passport');
var app = express();
var GitHubStrategy = require('passport-github').Strategy;

var GITHUB_CLIENT_ID = 'e5f1f43ef3e0e3c76a0c';
var GITHUB_CLIENT_SECRET = '0adea22d6b83b69cc0ed6554cf687ac636a1b61e';

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: 'http://127.0.0.1:8080/authorized'
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser());
  app.use(express.cookieParser('secretsauce'));
  app.use(express.session());
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {

  if (!req.session.user) {
    res.redirect('login');
  } else {
    res.render('index');
  }
});

app.get('/auth/github')

app.get('/create', function(req, res) {
  if (!req.session.user) {
    res.redirect('login');
  } else {
    res.render('index');
  }
});

app.get('/links', function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  var user = new User({
    username: username,
    password: password
  }, null, function(context){
    context.save().then(function(newUser) {
      Users.add(newUser);
      res.redirect('index');
    });
  });


});

app.get('/login', function(req, res) {
  if (req.session.user) {
    res.redirect('index');
  } else {
    res.render('login');
  }
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  Users.query(function(users) {
    users.where('username', '=', username);
  }).fetch().then(function(user) {
    if (user.length === 1) {
      bcrypt.compare(password, user.models[0].attributes.password, function(err, response) {
        if (response === false)  {
          throw err;
        } else {
          req.session.regenerate(function() {
            req.session.user = username;
            res.redirect('index');
          });
        }
      });
    } else {
      res.redirect('login');
    }
  });
});


app.get('/users', function(req, res) {
  Users.reset().fetch().then(function(users) {
    res.send(200, users.models);
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('index');
  });
});




/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
