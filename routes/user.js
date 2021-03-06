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

const { Customer, EWallet } = xendit;
const customer = new Customer({});
const ewallet = new EWallet({});

const orderCart = [];

router.get('/', async (req, res) => {
  const menus = await Menu.find({}).sort({ date: 1 });
  // const displayDate = function(m){
  //   const dates = m.map(menu => (moment(menu.date).toString()).split(' ') );
  //   return dates.map( d => ({ day: d[0], month: d[1], date: d[2], year: d[3] }) );
  // };
  delete req.session.path;
  res.render('home', { headTitle: 'Home', menus, displayDate, displayDay });
});

router.route('/register')
  .get( (req, res) => {
    res.render('section/register', { headTitle: 'Register' });
  })
  .post( async (req, res) => {
    const { fullname, username, email, password, confirmPassword, addresses, mobileNumber } = req.body;
    const splitName = fullname.split(' ');
    let name = {};
    if(splitName.length > 2){
      name = { firstName: splitName.shift(), lastName: splitName.pop(), middleName: splitName.join(' ') };
    } else if(splitName.length > 1){
      name = { firstName: splitName[0], lastName: splitName[1] };
    } else {
      name = { firstName: splitName[0] };
    }

    if(password === confirmPassword){
      try{
        const newCustomer = await customer.createCustomer({
          referenceID: `customer_${uuidv4()}`,
          givenNames: name.firstName,
          email,
          mobileNumber,
          addresses: [{ country: 'ID', ...addresses }]
        });
        const user = new User({ username, email, addresses, customerId: newCustomer.reference_id });
        const newUser = await User.register(user, password);
        return req.login(newUser, () => res.redirect('/') );
      } catch(e){
        console.log(e);
      }
    }

    req.flash('error', 'Your password and confirm password not match');
    res.redirect('/register');
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
    res.render('section/cart', { headTitle: 'Cart', carts, dotTotalPrices });
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
    if(orderCart.length === 0){
      delete req.session.cart;
    }
    res.redirect('/cart');
  });

router.route('/payment')
  .get(isLoggedIn, async (req, res) => {
    const { method, cartId } = req.query;
    const cart = orderCart.find(cart => cart.id === cartId);
    if(method === 'card'){
      const date = new Date();
      const minYear = date.getFullYear();
      return res.render('section/paymentCard', { headTitle: 'Card Payment', method, cart, minYear, dotTotalPrices });
    }
    const findUser = await User.findById(cart.owner);
    const findCustomer = await customer.getCustomerByReferenceID({
      referenceID: findUser.customerId
    });
    res.render('section/paymentOvo', { headTitle: 'Ovo Payment', method, cart, findCustomer, dotTotalPrices });
  })
  .post(isLoggedIn, async (req, res) => {
    const currentUser = req.user._id;
    const { paymentMethod, cartId } = req.query;
    const cart = orderCart.find(cart => cart.id === cartId);
    const { menu, menuTitle, quantity, message, totalPrices, owner } = cart;

    const findUser = await User.findById(currentUser);
    // const newInvoice = await invoice.createInvoice({
    //   externalID: `invoice_${uuidv4()}`,
    //   amount: totalPrices,
    //   payerEmail: findUser.email,
    //   description: `order for ${quantity} packages of ${menuTitle}`,
    //   shouldSendEmail: true,
    //   paymentMethods: ["CREDIT_CARD", "OVO"]
    // });
    // console.log(newInvoice);

    switch (paymentMethod) {
      case 'card':
        const searchCustomer = await customer.getCustomerByReferenceID({
          referenceID: findUser.customerId
        });
        const { given_names, surname, middle_name, addresses } = searchCustomer;
        const { amount, xenditToken, card_cvn } = req.body;
        try{
        const billingDetails = {
          given_names,
          surname,
          middle_name,
          address: addresses
        }
        const fetchh = await fetch('https://api.xendit.co/credit_card_charges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': process.env.BASE64_FORMAT },
          body: JSON.stringify({ external_id: `card_charges_${uuidv4()}`, token_id: xenditToken, amount, card_cvn, currency: 'IDR', billing_details: billingDetails })
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
          if(orderCart.length === 0){
            delete req.session.cart;
          }
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
          
            case 'CAPTURE_AMOUNT_LIMIT_ERROR':
              req.flash('error', `${result.failure_reason}, your card is below the minimum limit or above the maximum limit`);
              res.redirect(`/payment?method=card&cartId=${cartId}`);
              break;
          }
          
        }
        } catch(err){
          console.log(err);
        }
        break;
    
      case 'ew':
        const findCustomer = await customer.getCustomerByReferenceID({
          referenceID: findUser.customerId
        });

        try{
          const createEWCharge = await ewallet.createEWalletCharge({
            referenceID: `ewallet_charge_${uuidv4()}`,
            currency: 'IDR',
            amount: parseInt(totalPrices),
            checkoutMethod: 'ONE_TIME_PAYMENT',
            channelCode: 'ID_OVO',
            customerID: findUser.customerId,
            channelProperties: {
              mobileNumber: findCustomer[0].mobile_number
            }
          });
          if(createEWCharge.status === 'PENDING'){
            req.session.ewId = createEWCharge.id;
            req.session.cartId = cartId;
            const findeWallet = await ewallet.getEWalletChargeStatus({ chargeID: req.session.ewId });
            const ewStatus = async () => {
              return findeWallet
            }
            const checkEWCharge = setInterval(ewStatus, 1000);
            if(checkEWCharge.status !== 'PENDING'){
              clearInterval(checkEWCharge);
              return res.redirect(`/myorders/${req.user._id}`);
            }
            // return res.redirect('/payment/ovo-pending-payment');
            // try{
            //   const findEWCharge = await ewallet.getEWalletChargeStatus({ chargeID: createEWCharge.id });
            // }catch(err){ console.log(err) }
          }
        } catch(err){ console.log(err) }
        break;
    }
  });

router.get('/payment/ovo-pending-payment', isLoggedIn, async(req, res) => {
  // const findEW = await ewallet.getEWalletChargeStatus({ chargeID: req.session.ewId });
  // const ewStatus = async () => {
  //   return findEW
  // }
  // const checkEWCharge = setInterval(ewStatus, 1000);
  // if(checkEWCharge.status === 'SUCCEEDED'){
  //   clearInterval(checkEWCharge);
  //   return res.redirect(`/myorders/${req.user._id}`);
  // } else if(findEW.status === 'FAILED' || 'VOIDED'){
  //   clearInterval(checkEWCharge);
    
  // }
  res.render('section/ovoPending', { headTitle: 'Waiting for ovo payment', findEW });
});

router.get('/cart/:id', isLoggedIn, async(req, res) => {
  const { id } = req.params;
  const cart = orderCart.find(order => order.id === id);
  const menu = await Menu.findById(cart.menu);
  res.render('section/checkout', { headTitle: 'Order Checkout', cart, menu, dotTotalPrices });
});

router.get('/myorders/:userId', isLoggedIn, async (req, res) => {
  const { userId } = req.params;
  const userOrders = await User.findOne({_id: userId}).populate({ path: 'order', populate: { path: 'menu' } });
  function displayDateDayMonth(date){
    return moment(date).format('dddd, MMMM Do');
  }
  const { ewId, cartId } = req.session;
  if(ewId && cartId){
    const currenntUser = req.user._id;
    const findEW = await ewallet.getEWalletChargeStatus({ chargeID: ewId });
    if(findEW.status === 'SUCCEEDED'){
      const cart = orderCart.find(cart => cart.id === cartId);
      const { menu, quantity, message, totalPrices, owner } = cart;
      const newOrder = new Order({ menu, quantity, message, owner, totalPrices, status: 'Waiting for seller to accept the order' });
      newOrder.payment.push({ paymentMethod: 'EWALLET', paymentDate: findEW.created, chargeId: findEW.id });
      const user = await User.findById(currenntUser);
      user.order.push(newOrder);
      await user.save();
      await newOrder.save();
      const findIndex = orderCart.findIndex(cart => cart.id === cartId);
      orderCart.splice(findIndex, 1);
      req.session.cart = orderCart;
      if(orderCart.length === 0){
        delete req.session.cart;
      }
      req.flash('success', 'Successfully make a new order');
      delete req.session.ewId;
      delete req.session.cartId;
      return res.redirect(`/myorders/${currenntUser}`);
    }

    if(findEW.status === 'FAILED'){
      switch (findEW.failure_code) {
        case 'ACCOUNT_ACCESS_BLOCKED':
          req.flash('error', `Payment failed, ${findEW.failure_code}, your eWallet account has been restricted by eWallet provider`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'INVALID_MERCHANT_CREDENTIALS':
          req.flash('error', `Payment failed, ${findEW.failure_code}, Merchant credentials met with an error with the eWallet provider`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'USER_DECLINED_PAYMENT':
          req.flash('error', `Payment failed, ${findEW.failure_code}, you declined the payment request`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'INVALID_ACCOUNT_DETAILS':
          req.flash('error', `Payment failed, ${findEW.failure_code}, your account detail is invalid`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'MAXIMUM_LIMIT_REACHED':
          req.flash('error', `Payment failed, ${findEW.failure_code}, your eWallet account has reached maximum transaction limit`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'USER_UNREACHABLE':
          req.flash('error', `Payment failed, ${findEW.failure_code}, your device cannot be reached. Common reasons include unstable network, device error or jailbroken device.`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'CHANNEL_UNAVAILABLE':
          req.flash('error', `Payment failed, ${findEW.failure_code}, eWallet provider service is experiencing unexpected issues`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'INSUFFICIENT_BALANCE':
          req.flash('error', `Payment failed, ${findEW.failure_code}, your eWallet account balance is insufficient`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
  
        case 'ACCOUNT_NOT_ACTIVATED':
          req.flash('error', `Payment failed, ${findEW.failure_code}, your eWallet account has not been activated yet. Please activate first in eWallet provider app, before retry`);
          delete req.session.ewId;
          delete req.session.cartId;
          res.redirect(`/myorders/${currenntUser}`);
          break;
      }
    }
  }
  res.render('section/myorders', { headTitle: 'My Orders', userOrders, dateValue, displayDate, displayDateDayMonth, dotTotalPrices });
});

module.exports = {router, orderCart};