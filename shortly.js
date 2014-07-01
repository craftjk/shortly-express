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
var config = require('./oauth.js');
var app = express();
var GitHubStrategy = require('passport-github').Strategy;

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: config.ids.github.clientID,
    clientSecret: config.ids.github.clientSecret,
    callbackURL: config.ids.github.callbackURL
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
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
  app.use(passport.initialize());
  app.use(passport.session());
});

var ensureAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.render('login');
};

app.get('/', ensureAuthenticated, function(req, res) {
  res.render('index');
});

app.get('/auth/github', passport.authenticate('github'), function(req,res) {});

app.get('/authorized',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  }
);

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
// app.get('/signup', function(req, res) {
//   res.render('signup');
// });

// app.post('/signup', function(req, res) {
//   var username = req.body.username;
//   var password = req.body.password;

//   var user = new User({
//     username: username,
//     password: password
//   }, null, function(context){
//     context.save().then(function(newUser) {
//       Users.add(newUser);
//       res.redirect('index');
//     });
//   });


// });

// app.get('/login', function(req, res) {
//   if (req.session.user) {
//     res.redirect('index');
//   } else {
//     res.render('login');
//   }
// });

// app.post('/login', function(req, res) {
//   var username = req.body.username;
//   var password = req.body.password;

//   Users.query(function(users) {
//     users.where('username', '=', username);
//   }).fetch().then(function(user) {
//     if (user.length === 1) {
//       bcrypt.compare(password, user.models[0].attributes.password, function(err, response) {
//         if (response === false)  {
//           throw err;
//         } else {
//           req.session.regenerate(function() {
//             req.session.user = username;
//             res.redirect('index');
//           });
//         }
//       });
//     } else {
//       res.redirect('login');
//     }
//   });
// });


app.get('/users', function(req, res) {
  Users.reset().fetch().then(function(users) {
    res.send(200, users.models);
  });
});

app.get('/logout', function(req, res) {
  req.logout();
  res.render('login');
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
