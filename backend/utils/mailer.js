const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Sends the OTP to the user's real inbox.
 * Falls back to logging to console if Gmail credentials aren't configured,
 * so local dev/demo never gets blocked by missing SMTP setup.
 */
async function sendOtpEmail(toEmail, otp) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`\n[OTP - EMAIL NOT CONFIGURED] Code for ${toEmail}: ${otp}\n`);
    return;
  }

  await transporter.sendMail({
    from: `"StockSense" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Your StockSense password reset code',
    text: `Your one-time password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: auto;">
        <h2 style="margin-bottom: 4px;">Reset your StockSense password</h2>
        <p style="color: #555;">Use the code below. It expires in 10 minutes.</p>
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; background: #F3F4F1; padding: 14px 20px; border-radius: 6px; text-align: center; margin: 16px 0;">
          ${otp}
        </div>
        <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  });
}

module.exports = { sendOtpEmail };
