// login.js

let mode = 'login'; // 'login' | 'register'

const tabs = document.querySelectorAll('.login-tab');
const form = document.getElementById('authForm');
const submitBtn = document.getElementById('submitBtn');
const errorEl = document.getElementById('loginError');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    mode = tab.dataset.mode;
    submitBtn.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    errorEl.textContent = '';
  });
});

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

  const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

  try {
    const res = await fetch(endpoint, {
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

    window.location.href = 'index.html';
  } catch (err) {
    errorEl.textContent = 'Could not reach the server';
  }
});
