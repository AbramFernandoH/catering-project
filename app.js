// npm modules
require('dotenv').config();
const express = require('express');
const engine = require('ejs-mate');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const flash = require('connect-flash');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// native modules
const path = require('path');

// local modules
const User = require('./model/user');
const userRoutes = require('./routes/user');
const orderRoutes = require('./routes/order');
const adminRoutes = require('./routes/admin');

const app = express();

mongoose.connect('mongodb://localhost:27017/catering-project', {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false});

const db = mongoose.connection;
db.on('error', console.log.bind(console, "Connection error!"));
db.once('open', () => console.log('Database connected'));

app.engine('ejs', engine);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));
app.use(flash());
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true, cookie: {
  expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  maxAge: 1000 * 60 * 60 * 24 * 7
}
}));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.authUser = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use('/', userRoutes.router);
app.use('/order', orderRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3000;

// app.get('/buatCustomer', async (req, res) => {
  // list all customers
  // const allCustomers = await stripe.customers.list({});
  // const customers = allCustomers.data.map(customer => ({ id: customer.id, name: customer.name, email: customer.email, address: customer.address }));
  // console.log(customers);

  // delete a customer with a given id
  // const deleteCustomer = await stripe.customers.del('cus_JSU03SrfK4I5KL');
  // console.log(deleteCustomer);

//   res.render('section/makeCustomer', { headTitle: 'Make Customer' })
// });

// app.post('/makeCustomer', async (req, res) => {
//   const { name, email, address } = req.body;
//   const customer = await stripe.customers.create({
//     name,
//     email,
//     address: {
//       line1: address
//     }
//   });
//   req.session.cusId = customer.id;
//   res.redirect('/customers');
// });

app.get('/paymentConfirm', async (req, res) => {
  // const { id } = req.params;
  // const customer = await stripe.customers.retrieve({
  //   id
  // });
  
  res.render('section/confirmPay', { headTitle: 'Confirm Payment' });
});
const kembali = items => 5000000;

app.post('/create-payment-intent', async(req, res) => {
  const { items } = req.body;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: kembali(items),
    currency: 'idr',
    customer: req.session.cusId,
    // receipt_email: 'tes123@mail.com'
    // status: 'requires_payment_method' / 'requires_confirmation' / 'requires_action'/ 'processing' / 'requires_capture' / 'canceled' / 'succeeded'
  });
  delete req.session.cusId;
  res.send({ clientSecret: paymentIntent.client_secret });
});

app.listen(PORT, () => { console.log('server running on port 3000') })