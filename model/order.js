const mongoose = require('mongoose');
const { Schema } = mongoose;

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
  }
});

module.exports = mongoose.model('Order', orderSchema);