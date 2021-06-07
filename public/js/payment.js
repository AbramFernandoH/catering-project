const paymentCard = document.querySelector('#payment-card');
const paymentForm = document.querySelector('#form-payment-card');
const submitBtn = document.querySelector('#pay-card');
const cardNumber = document.querySelector('#card-number');
const expMonth = document.querySelector('#exp-month');
const expYear = document.querySelector('#exp-year');
const cardCVN = document.querySelector('#card-cvn');
const modal3DS = document.querySelector('#modal3DS');
const iframe = document.querySelector('#iframe-card-payment');

async function xenditResponseHandler(err, cardToken){
  if(err){
    document.querySelector('#pay-card-error').value = err.message;
    submitBtn.disabled = true;
    return;
  }

  if(cardToken.status === 'VERIFIED'){

    const token = cardToken.id;
    const newEl = document.createElement('input');
    newEl.setAttribute('type', 'hidden');
    newEl.setAttribute('name', 'xenditToken');
    newEl.setAttribute('value', token);
    await document.querySelector('#form-payment-card .hidden-inputs').appendChild(newEl);
    paymentForm.submit();

  } else if(cardToken.status === 'IN_REVIEW'){
    
    const paymentCardStyle = 'overflow: hidden; padding-right: 17px';
    paymentCard.setAttribute('class', 'modal-open');
    paymentCard.setAttribute('style', paymentCardStyle);
    paymentCard.setAttribute('data-bs-padding-right', '');
    
    const modalStyle = 'display: block;';
    modal3DS.removeAttribute('aria-hidden');
    modal3DS.setAttribute('class', 'modal fade show');
    modal3DS.setAttribute('style', modalStyle);
    modal3DS.setAttribute('aria-modal', 'true');
    modal3DS.setAttribute('role', 'dialog');

    iframe.setAttribute('src', cardToken.payer_authentication_url);
    iframe.setAttribute('height', '450');
    iframe.setAttribute('width', '500');

  } else if(cardToken.status === 'FAILED'){
    console.log(cardToken);

    if(paymentCard.hasAttribute('data-bs-padding-right')){

      paymentCard.removeAttribute('data-bs-padding-right');
      paymentCard.removeAttribute('class');
      paymentCard.removeAttribute('style');

      modal3DS.setAttribute('class', 'modal fade');
      modal3DS.setAttribute('aria-hidden', 'true');
      modal3DS.removeAttribute('style');
      modal3DS.removeAttribute('aria-modal');
      modal3DS.removeAttribute('role');

      iframe.removeAttribute('src');
      iframe.removeAttribute('height');
      iframe.removeAttribute('width');

    }

    document.querySelector('#pay-card-error').innerText = `${cardToken.failure_reason}, refresh the page if you want to using other card, or you can click cancel button for using other payment method`;
    submitBtn.disabled = true;
  }
}

paymentForm.addEventListener('submit', async(evt) => {
  evt.preventDefault();
  submitBtn.disabled = true;
  const amount = document.createElement('input');
  amount.setAttribute('type', 'hidden');
  amount.setAttribute('name', 'amount');
  amount.setAttribute('value', paymentForm.getAttribute('tp'));
  await document.querySelector('#form-payment-card .hidden-inputs').appendChild(amount);
  Xendit.card.createToken({
    amount: amount.value,
    card_number: cardNumber.value,
    card_exp_month: expMonth.value,
    card_exp_year: expYear.value,
    card_cvn: cardCVN.value,
    is_multiple_use: false,
    should_authenticate: true
  }, xenditResponseHandler);
});