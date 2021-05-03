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
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// native modules
const path = require('path');

// local modules
const Order = require('./model/order');
const User = require('./model/user');
const Menu = require('./model/menu');
const { isLoggedIn, isAdmin } = require('./middleware');

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

const displayDate = date => {
  return (moment(date).format('LLLL')).split(' '); // ex. Thursday, December 31, 2020 7:00 AM
}

const dateValue = date => {
  return moment(date).format('ddd');
}

const replaceComma = item => item.replace(',', '');

const dotTotalPrices = (val) => {
  const value = val.toString();
  const totalPrices = [...value];
  if(totalPrices.length >= 7){
    totalPrices.reverse().splice(3, 0, '.');
    totalPrices.splice(7, 0, '.');
    totalPrices.reverse();
  } else if (totalPrices.length >= 4){
    totalPrices.reverse().splice(3, 0, '.');
    totalPrices.reverse();
  }
  return totalPrices.join('');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'Catering-Project',
    allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'svg']
  }
});

const upload = multer({ storage });

app.use((req, res, next) => {
  res.locals.authUser = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
})

app.get('/', async (req, res) => {
  const menus = await Menu.find({});
  // const displayDate = function(m){
  //   const dates = m.map(menu => (moment(menu.date).toString()).split(' ') );
  //   return dates.map( d => ({ day: d[0], month: d[1], date: d[2], year: d[3] }) );
  // };
  res.render('home', { headTitle: 'Home', menus, displayDate, replaceComma });
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
  const allMenus = await Menu.find({});
  res.render('section/order', { headTitle: 'Order', displayDate, allMenus, dateValue });
});

app.post('/order', isLoggedIn, async (req, res) => {
  const currentUser = req.user._id;
  const { menu, quantity, message } = req.body;
  const newOrder = new Order({ menu, quantity, message, author: currentUser, totalPrices: (quantity * 50000) });
  const user = await User.findById(currentUser);
  user.order.push(newOrder);
  await user.save();
  await newOrder.save();
  req.flash('success', 'Successfully make a new order');
  res.redirect(`/myorders/${currentUser}`);
});

app.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
  // const userId = req.user._id;
  // const admin = await User.findOne({_id: userId});
  // await admin.isAnAdmin(userId);
  // console.log(admin);
  res.render('admin/adminHome', { headTitle: 'Admin' });
});

app.get('/menus', isLoggedIn, (req, res) => {
  res.render('admin/menus', { headTitle: 'Menus', minDate: minDate(), maxDate: maxDate() });
});

app.post('/menus', isLoggedIn, upload.array('images'), async (req, res) => {
  const images = req.files.map(f => ({url: f.path, filename: f.filename}));
  const newMenu = new Menu({...req.body});
  newMenu.images = images;
  await newMenu.save();
  res.redirect('/menus');
});

app.get('/myorders/edit/:orderId', isLoggedIn, async (req, res) => {
  const { orderId } = req.params;
  const findOrder = await Order.findOne({_id: orderId}).populate('menu');
  const allMenus = await Menu.find({});
  res.render('section/orderEdit', { headTitle: 'Edit Order', findOrder, allMenus, displayDate, dotTotalPrices })
});

app.patch('/order/:orderId', async (req, res) => {
  const userId = req.user._id;
  const { orderId } = req.params;
  try{
    const { quantity, message } = req.body;
    const order = await Order.updateOne({_id: orderId}, { quantity, message, totalPrices: (quantity * 50000) });
    req.flash('success', 'Successfully update the order');
    res.redirect(`/myorders/${userId}`);
  } catch(e) {
    console.log(e);
    req.flash('error', 'Update fail');
    res.redirect(`/myorders/${userId}`);
  }
});

app.delete('/order/:orderId', async (req, res) => {
  const userId = req.user._id;
  const { orderId } = req.params;
  await User.updateOne({_id: userId}, { $pull: { order: orderId } });
  await Order.deleteOne({_id: orderId});
  req.flash('success', 'Successfully cancel order');
  res.redirect(`/myorders/${userId}`);
});

app.get('/myorders/:userId', isLoggedIn, async (req, res) => {
  const { userId } = req.params;
  const userOrders = await User.findOne({_id: userId}).populate({ path: 'order', populate: { path: 'menu' } });
  res.render('section/myorders', { headTitle: 'My Orders', userOrders, dateValue, displayDate, replaceComma, dotTotalPrices });
});

app.listen(3000, () => { console.log('server running on port 3000') })