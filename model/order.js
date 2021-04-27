const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
  day: {
    type: String,
    enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    required: true
  },
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
  // menu: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Menu'
  // }
});

module.exports = mongoose.model('Order', orderSchema);