// auth.js — JWT login and reusable API helpers
// Uses the provided BASE_URL and stores the JWT as localStorage.token

const BASE_URL = "http://203.94.72.18/trainee/api";
window.BASE_URL = BASE_URL;

// Called by the button in index.html
async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value || '';
  const messageEl = document.getElementById('message');

  if (!username || !password) {
    if (messageEl) messageEl.textContent = 'Please enter username and password.';
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      const token = data.token || data.accessToken || data.access_token;
      if (!token) {
        alert('Login succeeded but no token was returned by the server.');
        return;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', username);
      window.location.href = 'halls.html';
    } else {
      alert('Login failed! Check your credentials.');
    }
  } catch (error) {
    console.error('Login error', error);
    alert('Network error while trying to login.');
  }
}

// Call this at the top of halls.html and bookings.html to protect pages
function requireLogin() {
  const token = localStorage.getItem('token');
  if (!token) window.location.href = 'index.html';
  return token;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// Reusable function to make authenticated API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('token');

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, options);

  if (response.status === 401) {
    // Clear stored auth and inform the user, then redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof window.showGlobalMessage === 'function') {
      window.showGlobalMessage('Session expired. Please login again.', 'error');
    } else {
      // fallback to alert
      try { alert('Session expired. Please login again.'); } catch (e) {}
    }
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error((payload && payload.message) || response.statusText || 'Request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function safeApiCall(endpoint, method = 'GET', body = null) {
  try {
    return await apiCall(endpoint, method, body);
  } catch (error) {
    // Log full error to the console for debugging
    console.error('API error:', error);

    // Prefer server-provided message when available
    const serverMessage = error && error.payload && (error.payload.message || error.payload.msg) || error.message;
    const userMessage = serverMessage || (error.status ? `Request failed (status ${error.status})` : 'Network error');

    // Show inline/global message if available, otherwise fallback to alert
    if (typeof window.showGlobalMessage === 'function') {
      window.showGlobalMessage(userMessage, 'error');
    } else {
      alert(userMessage);
    }

    // Also log friendly warnings for common statuses
    if (error.status === 400) console.warn('Invalid data sent.');
    else if (error.status === 403) console.warn("You don't have permission for this.");
    else if (error.status === 404) console.warn('Record not found.');
    else if (error.status === 500) console.warn('Server error.');

    // Expose last error for debugging
    window.lastApiError = error;
    return null;
  }
}

// Show a short-lived global message in pages (injects a #globalMessage element if missing)
function showGlobalMessage(text, type = 'info', timeoutMs = 6000) {
  try {
    let el = document.getElementById('globalMessage');
    if (!el) {
      el = document.createElement('div');
      el.id = 'globalMessage';
      el.style.position = 'fixed';
      el.style.top = '12px';
      el.style.right = '12px';
      el.style.zIndex = '9999';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '6px';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)';
      el.style.maxWidth = '420px';
      el.style.fontSize = '0.95rem';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.background = type === 'error' ? '#ffefef' : '#eef6ff';
    el.style.color = type === 'error' ? '#8b0000' : '#003366';

    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      try { el.textContent = ''; } catch (e) {}
    }, timeoutMs);
  } catch (e) {
    console.log('showGlobalMessage failed', e);
  }
}

window.showGlobalMessage = showGlobalMessage;

// Backward-compatible helper aliases used by the existing page scripts
function ensureAuth(redirect = true) {
  const token = requireLogin();
  if (!token && redirect) return false;
  return !!token;
}

async function authFetch(input, init = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const merged = Object.assign({}, init, { headers });
  return fetch(input, merged);
}

// Do not auto-redirect to halls when a token exists. Let the app show the login page
// and let protected pages call `requireLogin()` which will redirect if no token.

window.login = login;
window.requireLogin = requireLogin;
window.logout = logout;
window.apiCall = apiCall;
window.safeApiCall = safeApiCall;
window.ensureAuth = ensureAuth;
window.authFetch = authFetch;
