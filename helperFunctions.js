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
  return moment(date).format('dddd, MMMM Do, YYYY'); // ex. Thursday, December 31th, 2020
}

const dateValue = date => {
  return moment(date).format('ddd');
}

const displayDay = date => moment(date).format('dddd');

const displayDateAndTime = date => moment(date).format('MMMM Do YYYY, h:mm:ss a');

const dotTotalPrices = val => {
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

const middleName = name => {
  if(name.middleName){ return name.middleName }
  return null;
};

const surname = name => {
  if(name.lastName){ return name.lastName }
  return null;
};

module.exports = { calendarFormat, minDate, maxDate, menuDate, displayDate, dateValue, displayDay, dotTotalPrices, middleName, surname, displayDateAndTime }