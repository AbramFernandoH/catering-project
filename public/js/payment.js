const paymentCard = document.querySelector('#payment-card');
const paymentForm = document.querySelector('#form-payment-card');
const submitBtn = document.querySelector('#pay-card');
const cardNumber = document.querySelector('#card-number');
const expMonth = document.querySelector('#exp-month');
const expYear = document.querySelector('#exp-year');
const cardCVN = document.querySelector('#card-cvn');
const modal3DS = document.querySelector('#modal3DS');
const iframe = document.querySelector('#iframe-card-payment');

const JCB = /^[3][5]([2][8-9]|[3-8][0-9])/;
const Visa = /^[4]/;
const Mastercard = /^[5][1-5]|[2]([2][2-9][1-9]\d\d|[3-6]\d\d\d\d|[7]([0-1]\d\d\d|[2][0]\d\d))/;

const date = new Date();

cardNumber.addEventListener('input', () => {
  const CCNumCode = Mastercard || Visa || JCB;
  if((cardNumber.value).match(JCB) !== null){
    const JCBStyle = 'background-image: url(/icons/JCB_card.svg); background-position: 95%; background-repeat: no-repeat; background-size: 30px; padding-right: 15px;';
    cardNumber.setAttribute('style', JCBStyle);
  }else if((cardNumber.value).match(Visa) !== null){
    const VisaStyle = 'background-image: url(/icons/Visa_card.svg); background-position: 95%; background-repeat: no-repeat; background-size: 30px; padding-right: 15px;';
    cardNumber.setAttribute('style', VisaStyle);
  }else if((cardNumber.value).match(Mastercard) !== null){
    const MastercardStyle = 'background-image: url(/icons/Mastercard_card.svg); background-position: 95%; background-repeat: no-repeat; background-size: 30px; padding-right: 15px;';
    cardNumber.setAttribute('style', MastercardStyle);
  } else if((cardNumber.value).match(CCNumCode) === null) {
    cardNumber.removeAttribute('style');
  }

  if((cardNumber.value).length === 16){
    expMonth.focus();
  }

});

expMonth.addEventListener('input', () => {
  if((expMonth.value).length === 2){
    if(parseInt(expMonth.value) > 12 || parseInt(expMonth.value) < 0){
      alert('please input the right number of your card expired month');
      expMonth.setAttribute('style', 'border: solid red;');
      return expMonth.focus();
    }

    if(expMonth.getAttribute('style') !== null){
      expMonth.removeAttribute('style');
    }

    expYear.focus();
  }
});

expYear.addEventListener('input', () => {
  const pastYear = date.getFullYear() - 1;
  if((expYear.value).length === 4){
    if(parseInt(expYear.value) <= pastYear){
      alert('please input the right number of your card expired year');
      expYear.setAttribute('style', 'border: solid red;');
      return expYear.focus();
    }

    if(expYear.getAttribute('style') !== null){
      expYear.removeAttribute('style');
    }

    cardCVN.focus();
  }
});

cardCVN.addEventListener('input', () => {
  if((cardCVN.value).length === 3){
    if((cardCVN.value).length > 3){
      alert('please enter the right cvc code');
      cardCVN.setAttribute('style', 'border: solid red;');
      return cardCVN.focus();
    }

    if(cardCVN.getAttribute('style') !== null){
      cardCVN.removeAttribute('style');
    }

    cardCVN.blur();
  }
});

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

  // const todayYear = date.getFullYear();
  // const todayMonth = date.getMonth() + 1;

  // const wrongMonth = parseInt(expMonth.value) <= todayMonth || parseInt(expMonth.value) > 12;

  // if(parseInt(expYear.value) >= todayYear){
  //   if(parseInt(expYear.value) === todayYear && wrongMonth ){
  //     expMonth.setAttribute('style', 'border: solid red;');
  //     return expMonth.focus();
  //   }
    
  //   if(expYear.getAttribute('style') || expMonth.getAttribute('style' !== null)){
  //     expMonth.removeAttribute('style');
  //     expYear.removeAttribute('style');
  //   }

  // } else {
  //   expMonth.setAttribute('style', 'border: solid red;');
  //   expYear.setAttribute('style', 'border: solid red;');
  //   return expMonth.focus();
  // }

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