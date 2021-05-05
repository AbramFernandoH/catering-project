const moment = require('moment');

const calendarFormat = date => {
  const year = date.pop();
  const month = date.shift();
  const day = date.pop();
  return `${year}-${month}-${day}`;
}

const minDate = () => {
  const min = (moment().format('L')).split('/');
  return calendarFormat(min);
}

const maxDate = () => {
  const max = (moment().add(7, 'days').calendar()).split('/');
  return calendarFormat(max);
}

const menuDate = mDate => {
  const menuDate = (moment(mDate).format('L')).split('/');
  menuDate.unshift(menuDate.pop());
  return menuDate.join('-');
}

const displayDate = date => {
  return (moment(date).format('LLLL')).split(' '); // ex. Thursday, December 31, 2020 7:00 AM
}

const dateValue = date => {
  return moment(date).format('ddd');
}

const replaceComma = item => item.replace(',', '');

const dotTotalPrices = (val) => {
  const value = val.toString();
  const totalPrices = [...value];
  if(totalPrices.length >= 7){
    totalPrices.reverse().splice(3, 0, '.');
    totalPrices.splice(7, 0, '.');
    totalPrices.reverse();
  } else if (totalPrices.length >= 4){
    totalPrices.reverse().splice(3, 0, '.');
    totalPrices.reverse();
  }
  return totalPrices.join('');
}

module.exports = { calendarFormat, minDate, maxDate, menuDate, displayDate, dateValue, replaceComma, dotTotalPrices }