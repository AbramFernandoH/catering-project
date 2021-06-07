const express = require('express');
const Xendit = require('xendit-node');
const fetch = require('node-fetch');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const Menu = require('../model/menu');
const User = require('../model/user');
const Order = require('../model/order');

const { isLoggedIn, isAdmin } = require('../middleware');
const { displayDate, dateValue, dotTotalPrices } = require('../helperFunctions');
let { orderCart } = require('./user');

const xendit = new Xendit({ secretKey: process.env.XENDIT_SECRET_KEY });

const { Card, EWallet, Customer, Disbursement } = xendit;
const card = new Card({});
const customer = new Customer({});
const ewallet = new EWallet({});
const disbursement = new Disbursement({});

router.route('/')
  .get( isLoggedIn, async (req, res) => {
    const allMenus = await Menu.find({});
    res.render('section/order', { headTitle: 'Order', displayDate, allMenus, dateValue });
  })
  .post( isLoggedIn, async (req, res) => {
    const currentUser = req.user._id;

    const { cartId, menuId, quantity, message, paymentMethod } = req.body;
    const findOrder = orderCart.findIndex(cart => cart.id === cartId);
    const cart = orderCart[findOrder];

    cart.quantity = quantity;
    cart.message = message;
    cart.totalPrices = quantity * 50000;
    req.session.cart = orderCart;
    
    switch (paymentMethod) {
      case '.':
        req.flash('error', 'Please select payment method');
        res.redirect(`/cart/${cartId}`);
        break;
      
      case 'CARD':
        res.redirect(`/payment?method=card&cartId=${cartId}`);
        break;

      case 'EW':
        res.redirect(`/payment?method=ew&cartId=${cartId}`);
        break;

      case 'COD':
        const newOrder = new Order({ menu: menuId, quantity, message, owner: currentUser, totalPrices: quantity * 50000, status: 'Waiting for seller to accept the order' });
        newOrder.payment.push({ paymentMethod: 'COD', paymentDate: moment().format() });
        const user = await User.findById(currentUser);
        user.order.push(newOrder);
        await user.save();
        await newOrder.save();
        const findIndex = orderCart.findIndex(cart => cart.id === cartId);
        orderCart.splice(findIndex, 1);
        req.session.cart = orderCart;
        req.flash('success', 'Successfully make a new order');
        res.redirect(`/myorders/${currentUser}`);
        break;
    }
  })
  .patch( isLoggedIn, isAdmin, async (req, res) => {
    const { id } = req.query;
    const { status } = req.body;
    const findOrder = await Order.findById(id).populate('menu').populate('owner');
    const { chargeId, paymentMethod } = findOrder.payment[0];
    if(status === 'Order rejected by seller' && paymentMethod === 'CARD'){
      const cardCharge = await card.getCharge({ chargeID: chargeId });
      const refundURL = `https://api.xendit.co/credit_card_charges/${chargeId}/refunds`;
      const refundHeaders = { 'Content-Type': 'application/json', 'Authorization': process.env.BASE64_FORMAT, 'X-IDEMPOTENCY-KEY': uuidv4(), 'x-api-version': '2019-05-01' };
      const refundInfo = { amount: `${findOrder.totalPrices - 5000}`, external_id: cardCharge.external_id };
      const makeRefund = await fetch(refundURL, {
        method: 'POST',
        headers: refundHeaders,
        body: JSON.stringify(refundInfo)
      });
      const refundResult = await makeRefund.json();
      if(refundResult.status === 'FAILED'){
        req.flash('error', 'refund failed');
        return res.redirect(`/admin/orders/${findOrder.menu._id}`);
      }
    }
    await findOrder.updateOne({ status });
    res.redirect(`/admin/orders/${findOrder.menu._id}`);
  });

router.route('/:orderId')
  .get( isLoggedIn, async (req, res) => {
    const { orderId } = req.params;
    const findOrder = await Order.findOne({_id: orderId}).populate('menu');
    const allMenus = await Menu.find({});
    res.render('section/orderEdit', { headTitle: 'Edit Order', findOrder, allMenus, displayDate, dotTotalPrices })
  })
  .patch( isLoggedIn, async (req, res) => {
    const userId = req.user._id;
    const { orderId } = req.params;
    const { quantity, message } = req.body;
    await Order.updateOne({_id: orderId}, { quantity, message, totalPrices: (quantity * 50000) });
    req.flash('success', 'Successfully update the order');
    res.redirect(`/myorders/${userId}`);
  })
  .delete( isLoggedIn, async (req, res) => {
    const userId = req.user._id;
    const { orderId } = req.params;
    const findOrder = await Order.findById(orderId).populate('menu').populate('owner');
    const payment = findOrder.payment[0];
    if(payment.paymentMethod === 'CARD'){
      const cardCharge = await card.getCharge({ chargeID: payment.chargeId });
      const refundURL = `https://api.xendit.co/credit_card_charges/${payment.chargeId}/refunds`;
      const refundHeaders = { 'Content-Type': 'application/json', 'Authorization': process.env.BASE64_FORMAT, 'X-IDEMPOTENCY-KEY': uuidv4(), 'x-api-version': '2019-05-01' };
      const refundInfo = { amount: `${findOrder.totalPrices - 10000}`, external_id: cardCharge.external_id };
      const makeRefund = await fetch(refundURL, {
        method: 'POST',
        headers: refundHeaders,
        body: JSON.stringify(refundInfo)
      });
      const refundResult = await makeRefund.json();
      if(refundResult.status === 'FAILED'){
        req.flash('error', 'refund failed');
        return res.redirect(`/myorders/${userId}`);
      }
    }else if(payment.paymentMethod === 'EWALLET'){
      const findCustomer = await customer.getCustomerByReferenceID({ referenceID: findOrder.owner.customerId });
      const accountHolderName = [];
      accountHolderName.push(findCustomer[0].given_names);
      if(findCustomer[0].middle_name && findCustomer[0].surname){
        accountHolderName.push(findCustomer[0].middle_name);
        accountHolderName.push(findCustomer[0].surname);
      } else if(findCustomer[0].surname){
        accountHolderName.push(findCustomer[0].surname);
      }
      const findCharge = await ewallet.getEWalletChargeStatus({ chargeID: payment.chargeId });
      const ewalletCode = (findCharge.channel_code).split('_');
      const accountNumber = (findCustomer[0].mobile_number).replace('+62', '0');
      const newDisbursement = await disbursement.create({
        externalID: uuidv4(),
        bankCode: ewalletCode[1],
        accountHolderName: accountHolderName.join(' '),
        accountNumber,
        amount: (findOrder.totalPrices) - 10000,
        description: `Order cancel for ${findOrder.quantity} package of ${findOrder.menu.title}`
      });
      if(newDisbursement.status === 'PENDING'){
        const findDisbursement = await disbursement.getByID({ disbursementID: newDisbursement.id });
        const disbursementStatus = async () => findDisbursement;
        const checkDisbursement = setInterval(disbursementStatus, 1000);
        if(checkDisbursement.status === 'FAILED'){
          clearInterval(checkDisbursement);
          req.flash('error', 'refund failed');
          return res.redirect(`/myorders/${userId}`);
        }
        if(checkDisbursement.status === 'COMPLETED'){
          clearInterval(checkDisbursement);
        }
      }
    }
    await User.updateOne({_id: userId}, { $pull: { order: orderId } });
    await Order.deleteOne({_id: orderId});
    req.flash('success', 'Successfully cancel the order');
    res.redirect(`/myorders/${userId}`);
  });

module.exports = router;