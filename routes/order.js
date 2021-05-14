const express = require('express');
const router = express.Router();

const Menu = require('../model/menu');
const User = require('../model/user');
const Order = require('../model/order');

const { isLoggedIn } = require('../middleware');
const { displayDate, dateValue, dotTotalPrices } = require('../helperFunctions');
let { orderCart } = require('./user');

router.route('/')
  .get( isLoggedIn, async (req, res) => {
    const allMenus = await Menu.find({});
    res.render('section/order', { headTitle: 'Order', displayDate, allMenus, dateValue });
  })
  .post( isLoggedIn, async (req, res) => {
    const currentUser = req.user._id;
    const { cartId, menuId, quantity, message, paymentMethod } = req.body;
    if(paymentMethod === 'choose'){
      req.flash('error', 'Please Choose Payment Method');
      return res.redirect(`/cart/${cartId}`);
    } else if(paymentMethod === 'COD'){
      if(req.session.paymentIntentId){ delete req.session.paymentIntentId }
      const newOrder = new Order({ menu: menuId, quantity, message, owner: currentUser, totalPrices: quantity * 50000, paymentMethod, status: 'Waiting for seller to accept the order' });
      const user = await User.findById(currentUser);
      user.order.push(newOrder);
      await user.save();
      await newOrder.save();
      const findIndex = orderCart.findIndex(cart => cart.id === cartId);
      orderCart.splice(findIndex, 1);
      req.session.cart = orderCart;
      req.flash('success', 'Successfully make a new order');
      return res.redirect(`/myorders/${currentUser}`);
    } else {
      req.session.orderCheckout = { menu: menuId, quantity, message, owner: currentUser, totalPrices: quantity * 50000, paymentMethod, status: 'Waiting for seller to accept the order', cartId };
      res.redirect('/paymentConfirm');
    }
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
    await User.updateOne({_id: userId}, { $pull: { order: orderId } });
    await Order.deleteOne({_id: orderId});
    req.flash('success', 'Successfully cancel the order');
    res.redirect(`/myorders/${userId}`);
  });

module.exports = router;