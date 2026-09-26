const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { isNonEmptyString, isValidEmail, isValidPassword, collectErrors } = require('../utils/validate');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// ---------------- SIGNUP ----------------
router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;

  const errors = collectErrors([
    [isNonEmptyString(name, 100), 'Name is required (max 100 chars).'],
    [isValidEmail(email), 'A valid email is required.'],
    [isValidPassword(password), 'Password must be at least 8 characters and include a letter and a number.'],
    [['inventory_manager', 'warehouse_staff'].includes(role), 'Role must be inventory_manager or warehouse_staff.']
  ]);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing.length) return res.status(409).json({ errors: ['An account with this email already exists.'] });

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase(), password_hash, role]
    );

    const user = { id: result.insertId, name: name.trim(), email: email.toLowerCase(), role };
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Server error during signup.'] });
  }
});

// ---------------- LOGIN ----------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!isValidEmail(email) || !isNonEmptyString(password, 255)) {
    return res.status(400).json({ errors: ['Valid email and password are required.'] });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ errors: ['Invalid email or password.'] });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ errors: ['Invalid email or password.'] });

    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Server error during login.'] });
  }
});

// ---------------- FORGOT PASSWORD: REQUEST OTP ----------------
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!isValidEmail(email)) return res.status(400).json({ errors: ['A valid email is required.'] });

  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    // Always respond the same way whether or not the account exists (avoid user enumeration)
    if (!rows.length) return res.json({ message: 'If that account exists, an OTP has been sent.' });

    const userId = rows[0].id;
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    const otp_hash = await bcrypt.hash(otp, 10);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min validity

    await pool.query(
      'INSERT INTO otp_requests (user_id, otp_hash, expires_at) VALUES (?, ?, ?)',
      [userId, otp_hash, expires_at]
    );

    // No external email/SMS API dependency (per hackathon constraint) — simulate delivery via server console.
    // In a real deployment, swap this line for your own SMTP server.
    console.log(`\n📩 [OTP] Password reset code for ${email}: ${otp}  (valid 10 min)\n`);

    res.json({ message: 'If that account exists, an OTP has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Server error while generating OTP.'] });
  }
});

// ---------------- FORGOT PASSWORD: VERIFY OTP + RESET ----------------
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const errors = collectErrors([
    [isValidEmail(email), 'A valid email is required.'],
    [isNonEmptyString(otp, 6), 'OTP is required.'],
    [isValidPassword(newPassword), 'New password must be at least 8 characters and include a letter and a number.']
  ]);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!users.length) return res.status(400).json({ errors: ['Invalid OTP or email.'] });
    const userId = users[0].id;

    const [otpRows] = await pool.query(
      `SELECT * FROM otp_requests
       WHERE user_id = ? AND used = 0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (!otpRows.length) return res.status(400).json({ errors: ['OTP expired or not found. Request a new one.'] });

    const otpRow = otpRows[0];
    if (otpRow.attempts >= 5) {
      return res.status(429).json({ errors: ['Too many attempts. Request a new OTP.'] });
    }

    const match = await bcrypt.compare(otp, otpRow.otp_hash);
    if (!match) {
      await pool.query('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = ?', [otpRow.id]);
      return res.status(400).json({ errors: ['Incorrect OTP.'] });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, userId]);
    await pool.query('UPDATE otp_requests SET used = 1 WHERE id = ?', [otpRow.id]);

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errors: ['Server error while resetting password.'] });
  }
});

module.exports = router;
