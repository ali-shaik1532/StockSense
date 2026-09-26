const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Must be false for port 587
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: {
    // Bypasses strict network intercepts
    rejectUnauthorized: false
  }
});
/**
 * Sends the OTP to the user's real inbox.
 * Falls back to logging to console if Gmail credentials aren't configured,
 * so local dev/demo never gets blocked by missing SMTP setup.
 */
async function sendOtpEmail(toEmail, otp) {
  // ALWAYS print the OTP to the terminal just in case the email gets delayed
  console.log(`\n[OTP - DEMO BACKUP] Code for ${toEmail}: ${otp}\n`);

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[EMAIL NOT CONFIGURED] Skipping SMTP dispatch.`);
    return;
  }

  try {
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
    console.log(`✅ Email sent successfully to ${toEmail}`);
  } catch (error) {
    // Catches authentication errors so your server stays alive
    console.error(`❌ Email failed to send, but demo can proceed. Error: ${error.message}`);
  }
}

module.exports = { sendOtpEmail };