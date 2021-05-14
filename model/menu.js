const mongoose = require('mongoose');
const { Schema } = mongoose;

const ImagesSchema = new Schema({
  url: String,
  filename: String
});

ImagesSchema.virtual('displayImg').get(function(){
  return this.url.replace('/upload', '/upload/w_2500,h_2500,c_limit');
});

ImagesSchema.virtual('cbImg').get(function(){
  return this.url.replace('/upload', '/upload/w_250,h_250,c_limit');
});

const MenuSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  date: Date,
  description: {
    type: String,
    required: true
  },
  images: [ImagesSchema],
  productId: String
});

MenuSchema.post('findOneAndUpdate', async(doc) =>{
  console.log(doc);
})

module.exports = mongoose.model('Menu', MenuSchema);