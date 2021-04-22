// npm modules
const express = require('express');
const moment = require('moment');
const engine = require('ejs-mate');
const mongoose = require('mongoose');

// native modules
const path = require('path');

// local modules
const Order = require('./model/order');
const User = require('./model/user');

const app = express();

mongoose.connect('mongodb://localhost:27017/catering-project', {useNewUrlParser: true, useUnifiedTopology: true});

app.engine('ejs', engine);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('home', { headTitle: 'Home', navLinks: [ 'About Us', 'Menu This Week', 'Testimoni', 'Order', 'Contact Us', 'Log In' ] });
});

app.get('/login', (req, res) => {
  res.render('section/login', { headTitle: 'Login', navLinks: [ 'Home', 'Register' ] });
});

app.get('/register', (req, res) => {
  res.render('section/register', { headTitle: 'Register', navLinks: [ 'Home', 'Login' ] });
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

app.get('/menus', (req, res) => {
  res.render('admin/menus', { headTitle: 'Menus', navLinks: [ 'Home Admin', 'Logout' ] });
});

app.listen(3000, () => { console.log('server running on port 3000') })