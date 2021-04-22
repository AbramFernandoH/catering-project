const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
  Day: {
    type: String,
    enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    required: true
  },
  quantity: {
    type: Number,
    min: 0,
    required: true
  },
  message: String
});

module.exports = mongoose.model('Order', orderSchema);