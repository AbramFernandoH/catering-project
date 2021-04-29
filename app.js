// npm modules
require('dotenv').config();
const express = require('express');
const moment = require('moment');
const engine = require('ejs-mate');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const flash = require('connect-flash');
const multer = require('multer');

// native modules
const path = require('path');

// local modules
const Order = require('./model/order');
const User = require('./model/user');
const Menu = require('./model/menu');
const { isLoggedIn } = require('./middleware');

const app = express();
const upload = multer({ dest: 'uploads/' });

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
app.use(flash());
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true, cookie: {
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

function minDate(){
  const todayDate = (moment().format('L')).split('/');
  const todayYear = todayDate.pop();
  const todayMonth = todayDate.shift();
  const todayDay = todayDate.pop();
  const minDate = `${todayYear}-${todayMonth}-${todayDay}`;
  return minDate;
}

function maxDate(){
  const oneWeekFromNow = (moment().add(7, 'days').calendar()).split('/');
  const add1WeekYear = oneWeekFromNow.pop();
  const add1WeekMonth = oneWeekFromNow.shift();
  const add1WeekDay = oneWeekFromNow.pop();
  const maxDate = `${add1WeekYear}-${add1WeekMonth}-${add1WeekDay}`;
  return maxDate;
}

app.use((req, res, next) => {
  res.locals.authUser = req.user;
  res.locals.error = req.flash('error');
  next();
})

app.get('/', (req, res) => {
  res.render('home', { headTitle: 'Home' });
});

app.get('/login', (req, res) => {
  res.render('section/login', { headTitle: 'Login' });
});

app.get('/register', (req, res) => {
  res.render('section/register', { headTitle: 'Register' });
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.post('/register', async (req, res) => {
  const { username, email, password, address } = req.body;
  const user = new User({ username, email, address });
  const newUser = await User.register(user, password);
  req.login(newUser, () => {
    res.redirect('/');
  });
});

app.post('/login', passport.authenticate('local', { failureFlash: 'Your username and / or password wrong', failureRedirect: '/login' }), (req, res) => {
  res.redirect('/');
});

app.get('/order', isLoggedIn, async (req, res) => {
 res.render('section/order', { headTitle: 'Order' });
});

app.post('/order', isLoggedIn, async (req, res) => {
  const currentUser = req.user._id;
  const { day, quantity, message } = req.body;
  const newOrder = new Order({ day, quantity, message, author: currentUser });
  const user = await User.findById(currentUser);
  user.order.push(newOrder);
  await user.save();
  await newOrder.save();
  res.redirect('/order');
});

app.get('/admin', (req, res) => {
  res.render('admin/adminHome', { headTitle: 'Admin' });
});

app.get('/menus', async (req, res) => {
  const menus = await Menu.find({});
  const dates = menus.map(menu => (moment(menu.date).toString()).split(' ') );
  const menusDate = dates.map( d => ({ day: d[0], month: d[1], date: d[2], year: d[3] }) );
  res.render('admin/menus', { headTitle: 'Menus', minDate: minDate(), maxDate: maxDate(), menusDate });
});

app.post('/menus', upload.array('images'), (req, res) => {
  const images = req.files.map(f => ({url: f.path, filename: f.filename}));
  const newMenu = new Menu({...req.body});
  newMenu.images = images;
  newMenu.save();
  res.redirect('/menus');
});

app.get('/myorders', (req, res) => {
  res.render('section/myorders', { headTitle: 'My Orders' })
});

app.listen(3000, () => { console.log('server running on port 3000') })