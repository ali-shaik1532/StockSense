// Run with: node test-email.js
// Tests Gmail SMTP directly, outside the app, so errors are easy to isolate.
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('GMAIL_USER loaded as:', process.env.GMAIL_USER);
console.log('GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 'MISSING');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

transporter.sendMail({
  from: `"StockSense Test" <${process.env.GMAIL_USER}>`,
  to: process.env.GMAIL_USER, // sends to yourself for the test
  subject: 'StockSense SMTP test',
  text: 'If you got this, Gmail SMTP is working correctly.'
}, (err, info) => {
  if (err) {
    console.error('FAILED:', err);
  } else {
    console.log('SUCCESS:', info.response);
  }
});
