const express = require('express');
const passport = require('passport');
const multer = require('multer');
const moment = require('moment');
const Xendit = require('xendit-node');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const router = express.Router();

const Menu = require('../model/menu');
const User = require('../model/user');
const Order = require('../model/order');
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
      addresses: [{ country: 'ID', ...addresses }]
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
      } catch(err){ console.log(err) }
    }

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

router.route('/payment')
  .get(isLoggedIn, async (req, res) => {
    const { method, cartId } = req.query;
    const cart = orderCart.find(cart => cart.id === cartId);
    if(method === 'card'){
      return res.render('section/paymentCard', { headTitle: `${method} Payment`, method, cart });
    }
    res.render('section/payment', { headTitle: `${method} Payment`, method, cart });
  })
  .post(isLoggedIn, async (req, res) => {
    const { paymentMethod, cartId } = req.query;
    const cart = orderCart.find(cart => cart.id === cartId);
    const { menu, quantity, message, totalPrices, owner } = cart;
    const currentUser = req.user._id;
    switch (paymentMethod) {
      case 'card':
        const { amount, xenditToken } = req.body;
        try{
        const fetchh = await fetch('https://api.xendit.co/credit_card_charges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': process.env.BASE64_FORMAT },
          body: JSON.stringify({ external_id: `card_charges_${uuidv4()}`, token_id: xenditToken, amount })
        });
        const result = await fetchh.json();
        
        if(result.status === 'CAPTURED'){
          const newOrder = new Order({ menu, quantity, message, owner, totalPrices, status: 'Waiting for seller to accept the order' });
          newOrder.payment.push({ paymentMethod: 'CARD', paymentDate: result.created, chargeId: result.id });
          const user = await User.findById(currentUser);
          user.order.push(newOrder);
          await user.save();
          await newOrder.save();
          const findIndex = orderCart.findIndex(cart => cart.id === cartId);
          orderCart.splice(findIndex, 1);
          req.session.cart = orderCart;
          req.flash('success', 'Successfully make a new order');
          return res.redirect(`/myorders/${currentUser}`);
        }

        if(result.status === 'FAILED'){
          switch (result.failure_reason) {
            case 'EXPIRED_CARD':
              req.flash('error', `${result.failure_reason}, your card is expired`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;
              
            case 'CARD_DECLINED':
              req.flash('error', `${result.failure_reason}, your card has been declined by the issuing bank`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;

            case 'CARD_DECLINED':
              req.flash('error', `${result.failure_reason}, your card has been declined by the issuing bank`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;

            case 'PROCESSOR_ERROR':
              req.flash('error', `${result.failure_reason}, the charge failed because there is an integration issue between your card and the bank`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;

            case 'INSUFFICIENT_BALANCE':
              req.flash('error', `${result.failure_reason}, your card does not have enough balance to complete the payment`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;
              
            case 'STOLEN_CARD':
              req.flash('error', `${result.failure_reason}, the charge is failed because you are using stolen card`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;

            case 'INACTIVE_CARD':
              req.flash('error', `${result.failure_reason}, your card is inactive`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;

            case 'TEMPORARY_SYSTEM_ERROR':
              req.flash('error', `${result.failure_reason}, there is a temporary system error when the charge attempts happens`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;
          
            default:
              req.flash('error', `${result.failure_reason}, your card is below the minimum limit or above the maximum limit`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;
          }
          
        }
        } catch(err){
          console.log(err);
        }
        
        break;
    
      default:
        break;
    }
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