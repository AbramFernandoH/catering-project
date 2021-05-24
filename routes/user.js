const express = require('express');
const passport = require('passport');
const multer = require('multer');
const moment = require('moment');
const Xendit = require('xendit-node');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const Menu = require('../model/menu');
const User = require('../model/user');
const { isLoggedIn } = require('../middleware');
const { displayDate, dateValue, displayDay, dotTotalPrices, middleName, surname } = require('../helperFunctions');

const storage = require('../cloudinary/cloudinary');
const upload = multer({ storage });

const xendit = new Xendit({ secretKey: process.env.XENDIT_SECRET_KEY });

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
    const { Customer } = xendit;
    const customer = new Customer({});
    const { fullname, username, email, password, addresses, mobileNumber } = req.body;
    const { streetLine1, streetLine2, city, province, postalCode } = addresses;
    const splitName = fullname.split(' ');
    let name = {};
    if(splitName.length > 2){
      name = { firstName: splitName.shift(), lastName: splitName.pop(), middleName: splitName.join(' ') };
    } else if(splitName.length > 1){
      name = { firstName: splitName[0], lastName: splitName[1] };
    } else {
      name = { firstName: splitName[0] };
    }
    
    const newCustomer = await customer.createCustomer({
      referenceID: `customer_${uuidv4()}`,
      givenNames: name.firstName,
      email,
      mobileNumber,
      middleName: middleName(name),
      surname:  surname(name),
      addresses: [{
        streetLine1,
        streetLine2,
        city,
        province,
        postalCode,
        country: 'ID'
      }]
    });

    const user = new User({ username, email, addresses, customerId: newCustomer.reference_id });

    const { VirtualAcc } = xendit;
    const va = new VirtualAcc({});

    const bank_code = ['BNI', 'BRI', 'MANDIRI', 'PERMATA', 'BCA', 'SAHABAT_SAMPOERNA'];
    for(let bank of bank_code){
      try{
      const newFixedVA = await va.createFixedVA({
        externalID: `va_${uuidv4()}`,
        bankCode: bank,
        name: fullname,
        isClosed: true,
        expectedAmt: 10000
      });
      await user.virtualAccounts.push({ vaId: newFixedVA.id, bankCode: bank });
      console.log(newFixedVA);
      } catch(err){ console.log(err) }
    }

    const newUser = await User.register(user, password);
    console.log(newUser);
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
  res.render('section/checkout', { headTitle: 'Order Checkout', cart, dotTotalPrices });
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