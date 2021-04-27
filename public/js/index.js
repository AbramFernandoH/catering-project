// for order page
const quantity = document.querySelector('#quantity');
const totalPrice = document.querySelector('#total-price');

quantity.addEventListener('input', evt => {
  totalPrice.innerText = `Rp${(quantity.value) * 50000}`;
})