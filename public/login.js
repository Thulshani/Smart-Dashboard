// login.js
// Sign-in only — there is no self-signup. Accounts are created by an
// Admin via the Manage Users screen (see routes/users.js).

const form = document.getElementById('authForm');
const errorEl = document.getElementById('loginError');

// If already logged in, skip straight to the dashboard
fetch('/api/auth/me', { credentials: 'include' })
    .then(res => {
      if (res.ok) window.location.href = 'index.html';
    })
    .catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // required so the session cookie gets set/sent
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Something went wrong';
      return;
    }

    // Managers/Admins land on the full dashboard; Developers/QA land on
    // their activity-only page.
    if (data.role === 'manager' || data.role === 'admin') {
      window.location.href = 'index.html';
    } else {
      window.location.href = 'my-activity.html';
    }
  } catch (err) {
    errorEl.textContent = 'Could not reach the server';
  }
});