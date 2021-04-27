const mongoose = require('mongoose');
const { Schema } = mongoose;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  admin: Boolean,
  order: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }]
});

// adding username, hash and salt from original password
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);