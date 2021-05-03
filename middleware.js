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
  const adminUser = await User.findOne({_id: userId});
  if(adminUser.admin !== true){
    req.flash('error', 'You are not authorized');
    return res.redirect('/');
  } else {
    req.flash('success', `Welcome back ${adminUser.username}`);
  }
  next();
}

module.exports = { isLoggedIn, isAdmin };