const mongoose = require('mongoose');
const { Schema } = mongoose;

const imagesSchema = new Schema({
  url: String,
  filename: String
})

const menuSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  detail: {
    type: String,
    required: true
  },
  images: [imagesSchema]
});

module.exports = mongoose.model('Menu', menuSchema);