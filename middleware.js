const mongoose = require('mongoose');
const User = require('./model/user');

const isLoggedIn = (req, res, next) => {
  if(!req.isAuthenticated()){
    req.flash('error', 'You are not authenticated');
    return res.redirect('/login');
  }
  next();
};

const isAdmin = async (req, res, next) => {
  const userId = req.user._id;
  const user = await User.findOne({_id: userId});
  if(user.admin !== true){
    req.flash('error', 'You are not authorized');
    return res.redirect('/');
  }
  next();
}

module.exports = { isLoggedIn, isAdmin };