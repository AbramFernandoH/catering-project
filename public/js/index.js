// for order page
const quantity = document.querySelector('#quantity');
const totalPrice = document.querySelector('#total-price');

quantity.addEventListener('input', evt => {
  const quantityVal = ((quantity.value) * 50000).toString();
  const totalPrices = [...quantityVal];
  if(totalPrices.length >= 7){
    totalPrices.reverse().splice(3, 0, '.');
    totalPrices.splice(7, 0, '.');
    totalPrices.reverse();
  } else if (totalPrices.length >= 4){
    totalPrices.reverse().splice(3, 0, '.');
    totalPrices.reverse();
  }
  const total = totalPrices.join('');
  totalPrice.innerText = `Rp ${total},00`;
})