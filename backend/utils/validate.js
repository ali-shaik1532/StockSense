const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKU_RE = /^[A-Z0-9][A-Z0-9\-_]{2,29}$/i; // 3-30 chars, alnum/dash/underscore

function isNonEmptyString(v, maxLen = 255) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isValidEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v) && v.length <= 150;
}

function isValidSku(v) {
  return typeof v === 'string' && SKU_RE.test(v);
}

function isPositiveNumber(v) {
  const n = Number(v);
  return !Number.isNaN(n) && n > 0;
}

function isNonNegativeNumber(v) {
  const n = Number(v);
  return !Number.isNaN(n) && n >= 0;
}

function isValidPassword(v) {
  // At least 8 chars, 1 letter, 1 number — reasonable for a hackathon demo, mention room to harden.
  return typeof v === 'string' && v.length >= 8 && /[A-Za-z]/.test(v) && /[0-9]/.test(v);
}

function collectErrors(checks) {
  // checks: array of [conditionBoolean, message]
  return checks.filter(([ok]) => !ok).map(([, msg]) => msg);
}

module.exports = {
  isNonEmptyString, isValidEmail, isValidSku, isPositiveNumber,
  isNonNegativeNumber, isValidPassword, collectErrors
};
