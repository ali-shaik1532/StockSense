// ==========================================================
// Central API wrapper. Change API_BASE if backend runs elsewhere.
// ==========================================================
const API_BASE = 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('ss_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('ss_user')); } catch { return null; }
}
function setSession(token, user) {
  localStorage.setItem('ss_token', token);
  localStorage.setItem('ss_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_user');
}

/**
 * Core request helper. Throws an Error with `.errors` (array) on failure
 * so callers can render validation messages directly.
 */
async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    const e = new Error('Cannot reach the server. Is the backend running?');
    e.errors = ['Cannot reach the server. Is the backend running?'];
    throw e;
  }

  if (res.status === 401) {
    clearSession();
    window.location.href = 'index.html';
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const e = new Error((data.errors && data.errors[0]) || 'Request failed.');
    e.errors = data.errors || ['Request failed.'];
    throw e;
  }
  return data;
}

function requireAuth() {
  if (!getToken()) window.location.href = 'index.html';
}

// Populate the errors list under a form element
function showFormErrors(containerEl, errors) {
  containerEl.innerHTML = '';
  if (!errors || !errors.length) return;
  const box = document.createElement('div');
  box.className = 'error-box';
  box.innerHTML = errors.map(e => `• ${e}`).join('<br>');
  containerEl.appendChild(box);
}
