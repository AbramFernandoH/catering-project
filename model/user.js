const mongoose = require('mongoose');
const { Schema } = mongoose;
const passportLocalMongoose = require('passport-local-mongoose');

const vaSchema = new Schema({
  vaId: {
    type: String,
    required: true
  },
  bankCode: {
    type: String,
    required: true
  }
}, { _id: false });

const UserSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  addresses: {
    streetLine1: {
      type: String,
      required: true
    },
    streetLine2: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    province: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    }
  },
  admin: Boolean,
  order: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }],
  customerId: String,
  virtualAccounts: [vaSchema]
});

UserSchema.methods.isAnAdmin = async function(){
  this.admin = true;
  return await this.save();
}

// adding username, hash and salt from original password
UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);