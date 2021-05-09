const express = require('express');
const passport = require('passport');
const multer = require('multer');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const Menu = require('../model/menu');
const User = require('../model/user');
const { isLoggedIn } = require('../middleware');
const { displayDate, dateValue, displayDay, dotTotalPrices } = require('../helperFunctions');

const storage = require('../cloudinary/cloudinary');
const upload = multer({ storage });

const orderCart = [];

router.get('/', async (req, res) => {
  const menus = await Menu.find({}).sort({ date: 1 });
  // const displayDate = function(m){
  //   const dates = m.map(menu => (moment(menu.date).toString()).split(' ') );
  //   return dates.map( d => ({ day: d[0], month: d[1], date: d[2], year: d[3] }) );
  // };
  res.render('home', { headTitle: 'Home', menus, displayDate, displayDay });
});

router.route('/register')
  .get( (req, res) => {
    res.render('section/register', { headTitle: 'Register' });
  })
  .post( async (req, res) => {
    const { username, email, password, address } = req.body;
    const user = new User({ username, email, address });
    const newUser = await User.register(user, password);
    req.login(newUser, () => {
      res.redirect('/');
    });
  });

router.route('/login')
  .get( (req, res) => {
    res.render('section/login', { headTitle: 'Login' });
  })
  .post( passport.authenticate('local', { failureFlash: 'Your username and / or password wrong', failureRedirect: '/login' }), (req, res) => {
    res.redirect('/');
  });

router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

router.route('/cart')
  .get( isLoggedIn, async (req, res) => {
    const carts = req.session.cart;
    res.render('section/cart', { headTitle: 'Cart', carts });
  })
  .post( isLoggedIn, async (req, res) => {
    const currentUser = req.user._id;
    const { quantity, menu } = req.body;
    req.session.cart = orderCart;
    const findMenu = await Menu.findOne({_id: menu});
    const date = moment(findMenu.date).format('dddd, MMMM Do, YYYY');
    const order = { ...req.body, owner: currentUser, totalPrices: quantity * 50000, menuTitle: findMenu.title, menuDate: date, id: uuidv4() };
    orderCart.push(order);
    res.redirect('/cart');
  })
  .delete( isLoggedIn, async (req, res) => {
    const { id } = req.query;
    const findIndex = orderCart.findIndex(cart => cart.id === id);
    orderCart.splice(findIndex, 1);
    req.session.cart = orderCart;
    res.redirect('/cart');
  });

router.get('/cart/:id', isLoggedIn, async(req, res) => {
  const { id } = req.params;
  const cart = orderCart.find(order => order.id === id);
  res.render('section/checkout', { headTitle: 'Order Checkout', cart });
});

router.get('/myorders/:userId', isLoggedIn, async (req, res) => {
  const { userId } = req.params;
  const userOrders = await User.findOne({_id: userId}).populate({ path: 'order', populate: { path: 'menu' } });
  function displayDateDayMonth(date){
    return moment(date).format('dddd, MMMM Do');
  }
  res.render('section/myorders', { headTitle: 'My Orders', userOrders, dateValue, displayDate, displayDateDayMonth, dotTotalPrices });
});

module.exports = {router, orderCart};