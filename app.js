const express = require('express');
const path = require('path');
const engine = require('ejs-mate');
const app = express();

app.engine('ejs', engine);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('home', { headTitle: 'Home', navLinks: [ 'About Us', 'Menu This Week', 'Testimoni', 'Order', 'Contact Us', 'Log In' ] });
});

app.get('/login', (req, res) => {
  res.render('section/login', { headTitle: 'Login', navLinks: [ 'Home', 'Register' ] });
});

app.get('/register', (req, res) => {
  res.render('section/register', { headTitle: 'Register', navLinks: [ 'Home', 'Login' ] });
});

app.get('/order', (req, res) => {
  res.render('section/order', { headTitle: 'Order', navLinks: [ 'Home', 'Login', 'Register' ] });
});

app.listen(3000, () => { console.log('server running on port 3000') })