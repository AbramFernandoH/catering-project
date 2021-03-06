const express = require('express');
const multer = require('multer');
const Xendit = require('xendit-node');
const router = express.Router();

const { storage, cloudinary } = require('../cloudinary/cloudinary');
const upload = multer({ storage });

const Menu = require('../model/menu');
const User = require('../model/user');
const Order = require('../model/order');
const { isLoggedIn, isAdmin } = require('../middleware');
const { minDate, maxDate, menuDate, displayDate, displayDay, dotTotalPrices, displayDateAndTime } = require('../helperFunctions');

const xendit = new Xendit({ secretKey: process.env.XENDIT_SECRET_KEY });

const { Card, EWallet } = xendit;
const card = new Card({});
const ewallet = new EWallet({});

router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  const userId = req.user._id;
  const user = await User.findOne({_id: userId});
  // await admin.isAnAdmin(userId);
  // console.log(admin);
  const allMenus = await Menu.find({});
  const allOrders = await Order.find({}).populate('menu').populate('owner');
  res.render('admin/adminHome', { headTitle: 'Admin Homepage', allMenus, allOrders, displayDate, displayDay });
});

router.route('/menu/create')
  .get( isLoggedIn, isAdmin, (req, res) => {
    res.render('admin/menus', { headTitle: 'Menus', minDate: minDate(), maxDate: maxDate() });
  })
  .post( isLoggedIn, isAdmin, upload.array('images'), async (req, res) => {
    const images = req.files.map(f => ({url: f.path, filename: f.filename}));
    const newMenu = new Menu({...req.body});
    newMenu.images = images;
    await newMenu.save();
    res.redirect('/admin');
  });

router.get('/paymentProof', async (req, res) => {
  const { orderId, chargeId, paymentMethod } = req.query;
  const findOrder = await Order.findById(orderId);
  if(paymentMethod === 'CARD'){
    const paymentProof = await card.getCharge({ chargeID: chargeId });
    return res.render('admin/paymentProof', { headTitle: 'Payment Proof', paymentProof, findOrder, displayDateAndTime, dotTotalPrices });
  } else {
    const paymentProof = await ewallet.getEWalletChargeStatus({ chargeID: chargeId });
    return res.render('admin/paymentProof', { headTitle: 'Payment Proof', paymentProof, findOrder, displayDateAndTime, dotTotalPrices });
  }
});

router.route('/menu/:menuId')
  .get( async (req, res) => {
    const { menuId } = req.params;
    const menu = await Menu.findOne({_id: menuId});
    res.render('admin/editMenu', { headTitle: 'Edit Menu', menu, minDate: minDate(), maxDate: maxDate(), menuDate: menuDate(menu.date) });
  })
  .patch( upload.array('images'), async (req, res) => {
    const { menuId } = req.params;
    const menu = await Menu.findByIdAndUpdate({_id: menuId}, { ...req.body });
    const images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    menu.images.push(...images);
    await menu.save();
    const { deleteImg } = req.body;
    if(deleteImg){
      if(deleteImg.length > 1){
      for(let filename of deleteImg){
        // delete images from cloudinary
        await cloudinary.uploader.destroy(filename);
      }} else {
        await cloudinary.uploader.destroy(deleteImg[0]);
      }
      // delete images from mongoose
      await menu.updateOne({ $pull: { images: { filename: {$in: deleteImg} } } });
    }
    req.flash('success', 'Successfully update a menu');
    res.redirect('/admin');
  })
  .delete( isLoggedIn, isAdmin, async (req, res) => {
    const { menuId } = req.params;
    const orders = await Order.find({ menu: menuId }).populate('owner');
    if(orders){
    if(orders.length > 1){
    for(let order of orders){
      await User.updateOne({_id: order.owner._id}, { $pull: {order: order._id} });
    }
    } else if(orders.length === 1) {
      await User.updateOne({_id: orders[0].owner._id}, { $pull: {order: orders[0]._id} });
    }}
    await Order.deleteMany({ menu: menuId });
    const menu = await Menu.findById(menuId);
    const menuImages = menu.images;
    if(menuImages.length > 1){
      for(let images of menuImages){
        await cloudinary.uploader.destroy(images.filename);
      } 
    } else {
      await cloudinary.uploader.destroy(menuImages[0].filename);
    }
    await menu.deleteOne();
    req.flash('success', 'Successfully delete a menu');
    res.redirect('/admin');
  });

router.get('/orders/:menuId', isLoggedIn, isAdmin, async (req, res) => {
  const { menuId } = req.params;
  const allOrders = await Order.find({ menu: menuId }).populate('menu').populate('owner');
  const findMenu = await Menu.findOne({_id: menuId});
  const menuTitle = findMenu.title;
  const menuDate = findMenu.date;
  const waitingOrders = await Order.find({ menu: menuId, status: 'Waiting for seller to accept the order' }).populate('menu').populate('owner');
  const acceptedOrders = await Order.find({ menu: menuId, status: 'Order accepted by seller' }).populate('menu').populate('owner');
  const rejectedOrders = await Order.find({ menu: menuId, status: 'Order rejected by seller' }).populate('menu').populate('owner');
  const doneOrders = await Order.find({ menu: menuId, status: 'Order done' }).populate('menu').populate('owner');
  res.render('admin/orders', { headTitle: `Orders for ${menuTitle}`, allOrders, displayDate, displayDay, menuTitle, menuDate, waitingOrders, acceptedOrders, rejectedOrders, doneOrders });
});

module.exports = router;