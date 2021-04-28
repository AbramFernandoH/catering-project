const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
  quantity: {
    type: Number,
    min: 0,
    required: true
  },
  message: String,
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  menu: {
    type: Schema.Types.ObjectId,
    ref: 'Menu'
  }
});

module.exports = mongoose.model('Order', orderSchema);