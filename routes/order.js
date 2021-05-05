const express = require('express');
const router = express.Router();
const Menu = require('../model/menu');
const User = require('../model/user');
const Order = require('../model/order');
const { isLoggedIn } = require('../middleware');
const { displayDate, dateValue, dotTotalPrices } = require('../helperFunctions');

router.route('/')
  .get( isLoggedIn, async (req, res) => {
    const allMenus = await Menu.find({});
    res.render('section/order', { headTitle: 'Order', displayDate, allMenus, dateValue });
  })
  .post( isLoggedIn, async (req, res) => {
    const currentUser = req.user._id;
    const { menu, quantity, message } = req.body;
    const newOrder = new Order({ menu, quantity, message, owner: currentUser, totalPrices: (quantity * 50000) });
    const user = await User.findById(currentUser);
    user.order.push(newOrder);
    await user.save();
    await newOrder.save();
    req.flash('success', 'Successfully make a new order');
    res.redirect(`/myorders/${currentUser}`);
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
    req.flash('success', 'Successfully cancel order');
    res.redirect(`/myorders/${userId}`);
  });

module.exports = router;