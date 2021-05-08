const express = require('express');
const passport = require('passport');
const multer = require('multer');
const router = express.Router();

const Menu = require('../model/menu');
const User = require('../model/user');
const { isLoggedIn } = require('../middleware');
const { displayDate, dateValue, replaceComma, dotTotalPrices } = require('../helperFunctions');

const storage = require('../cloudinary/cloudinary');
const menu = require('../model/menu');
const upload = multer({ storage });

router.get('/', async (req, res) => {
  const menus = await Menu.find({}).sort({ date: 1 });
  // const displayDate = function(m){
  //   const dates = m.map(menu => (moment(menu.date).toString()).split(' ') );
  //   return dates.map( d => ({ day: d[0], month: d[1], date: d[2], year: d[3] }) );
  // };
  res.render('home', { headTitle: 'Home', menus, displayDate, replaceComma });
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

router.get('/cart', isLoggedIn, async (req, res) => {
    const carts = req.session.cart;
    async function menuTitle(title){
     await Menu.findOne({_id: title});
    }
    // if(carts){
    // if(carts.length > 1){
    //   for(let cart of carts){
    //     console.log(menuTitle(cart.menu));
    //   }
    // } else {
    //   console.log(menuTitle(carts.menu));
    // } console.log(carts)}
    res.render('section/cart', { headTitle: 'Cart', carts, menuTitle });
  })

router.get('/myorders/:userId', isLoggedIn, async (req, res) => {
  const { userId } = req.params;
  const userOrders = await User.findOne({_id: userId}).populate({ path: 'order', populate: { path: 'menu' } });
  res.render('section/myorders', { headTitle: 'My Orders', userOrders, dateValue, displayDate, replaceComma, dotTotalPrices });
});

module.exports = router;