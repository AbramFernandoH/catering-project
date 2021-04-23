// npm modules
const express = require('express');
const moment = require('moment');
const engine = require('ejs-mate');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const flash = require('connect-flash');

// native modules
const path = require('path');

// local modules
const Order = require('./model/order');
const User = require('./model/user');

const app = express();

mongoose.connect('mongodb://localhost:27017/catering-project', {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.log.bind(console, "Connection error!"));
db.once('open', () => console.log('Database connected'));

app.engine('ejs', engine);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));
app.use(session({ secret: 'RahasiaaaSekali', resave: false, saveUninitialized: true, cookie: {
  expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  maxAge: 1000 * 60 * 60 * 24 * 7
}
}));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/', (req, res) => {
  res.render('home', { headTitle: 'Home', navLinks: [ 'About Us', 'Menu This Week', 'Testimoni', 'Order', 'Contact Us', 'Log In' ] });
});

app.get('/login', (req, res) => {
  res.render('section/login', { headTitle: 'Login', navLinks: [ 'Home', 'Register' ] });
});

app.get('/register', (req, res) => {
  res.render('section/register', { headTitle: 'Register', navLinks: [ 'Home', 'Login' ] });
});

app.post('/register', async (req, res) => {
  const { username, email, password, address } = req.body;
  const user = new User({ username, email, address });
  const newUser = await User.register(user, password);
  req.login(newUser, () => {
    res.redirect('/');
  });
});

app.get('/order', (req, res) => {
  res.render('section/order', { headTitle: 'Order', navLinks: [ 'Home', 'Login', 'Register' ] });
});

app.post('/order', async (req, res) => {
  const { day, quantity, message } = req.body;
  const newOrder = new Order({ day, quantity, message });
  await newOrder.save();
  res.redirect('/order');
});

app.get('/admin', (req, res) => {
  res.render('admin/adminHome', { headTitle: 'Admin', navLinks: [ 'Menus', 'Order', 'Logout' ] });
});

app.get('/menus', (req, res) => {
  res.render('admin/menus', { headTitle: 'Menus', navLinks: [ 'Home Admin', 'Logout' ] });
});

app.listen(3000, () => { console.log('server running on port 3000') })