const express = require('express');
const passport = require('passport');
const multer = require('multer');
const moment = require('moment');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const Menu = require('../model/menu');
const User = require('../model/user');
const Order = require('../model/order');
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
  // list all customers
  // const allCustomers = await stripe.customers.list({});
  // const customers = allCustomers.data.map(customer => ({ id: customer.id, name: customer.name, email: customer.email, address: customer.address }));
  // console.log(customers);

  // delete a customer with a given id
  // const deleteCustomer = await stripe.customers.del('cus_JSU03SrfK4I5KL');
  // console.log(deleteCustomer);
  res.render('home', { headTitle: 'Home', menus, displayDate, displayDay });
});

router.route('/register')
  .get( (req, res) => {
    res.render('section/register', { headTitle: 'Register' });
  })
  .post( async (req, res) => {
    const { username, email, password, address } = req.body;
    const newCustomer = await stripe.customers.create({
      name: username,
      email: email,
      address: {
        line1: address
      }
    });
    const user = new User({ username, email, address, customerId: newCustomer.id });
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

router.get('/paymentConfirm', isLoggedIn, async (req, res) => {
  res.render('section/confirmPay', { headTitle: 'Confirm Payment' });
});
  
router.post('/create-payment-intent', isLoggedIn, async(req, res) => {
  if(req.session.orderCheckout){
  if(req.session.paymentIntentId){
    const paymentIntent = await stripe.paymentIntents.retrieve(req.session.paymentIntentId);
    if(paymentIntent.metadata.cartId === req.session.orderCheckout.cartId){
      return res.send({ clientSecret: paymentIntent.client_secret });
    }
  } else {
    const { orderCheckout } = req.session;
    const user = await User.findById(orderCheckout.owner);
    const totalPrices = parseInt(`${orderCheckout.totalPrices}00`);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPrices,
      currency: 'idr',
      customer: user.customerId,
      receipt_email: user.email,
      metadata: { cartId: orderCheckout.cartId }
      // status: 'requires_payment_method' / 'requires_confirmation' / 'requires_action'/ 'processing' / 'requires_capture' / 'canceled' / 'succeeded'
    });
    req.session.paymentIntentId = paymentIntent.id;
    res.send({ clientSecret: paymentIntent.client_secret });
  }}
});

router.post('/confirmPayment', isLoggedIn, async(req, res) => {
  if(req.session.orderCheckout){
  const { orderCheckout } = req.session;
  const user = await User.findById(orderCheckout.owner);
  const paymentIntent = await stripe.paymentIntents.retrieve(req.session.paymentIntentId);
  if(paymentIntent.status === 'succeeded'){
    const { cartId, menu, quantity, message, paymentMethod } = orderCheckout;
    const currentUser = req.user._id;
    const newOrder = new Order({ menu, quantity, message, owner: currentUser, totalPrices: quantity * 50000, paymentMethod, status: 'Waiting for seller to accept the order' });
    delete paymentIntent.metadata.cartId;
    const updatePayment = await stripe.paymentIntents.update( paymentIntent.id, {metadata: { orderId: newOrder.id }});
    newOrder.paymentId = updatePayment.id;
    user.order.push(newOrder);
    await user.save();
    await newOrder.save();
    const findIndex = orderCart.findIndex(cart => cart.id === cartId);
    orderCart.splice(findIndex, 1);
    req.session.cart = orderCart;
    req.flash('success', 'Payment succeeded, Successfully make a new order');
    delete req.session.paymentIntentId;
    delete req.session.orderCheckout;
    return res.redirect(`/myorders/${req.user.id}`);
  }
    req.flash('error', `Payment ${paymentIntent.status}`);
    return res.redirect('/cart');
  } else {
    req.flash('error', 'Please make an order');
    return res.redirect('/order');
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