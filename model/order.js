const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentSchema = new Schema({
  paymentMethod: {
    type: String,
    enum: ['COD', 'CARD', 'EWALLET'],
    required: true
  },
  chargeId: String,
  paymentDate: {
    type: Date,
    required: true
  }
});

const orderSchema = new Schema({
  quantity: {
    type: Number,
    min: 1,
    required: true
  },
  message: String,
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  menu: {
    type: Schema.Types.ObjectId,
    ref: 'Menu'
  },
  totalPrices: {
    type: Number,
    min: 50000,
    required: true
  },
  status: {
    type: String,
    enum: ['Waiting for seller to accept the order', 'Order accepted by seller', 'Order rejected by seller', 'Order done']
  },
  payment: [paymentSchema]
});

module.exports = mongoose.model('Order', orderSchema);