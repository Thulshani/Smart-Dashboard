// admin-users.js
// Admin-only screen for creating and managing team accounts. If a
// non-admin somehow lands here, the backend will reject every API call
// with 403 anyway (see middleware/requireRole.js) — but we also bounce
// them straight back to the dashboard for a cleaner experience.

const API_BASE = '/api';

const ROLES = [
  { value: 'developer', label: 'Developer' },
  { value: 'qa', label: 'QA' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];
const ALLOWED_ROLES = ROLES.map((r) => r.value);

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });

  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  if (res.status === 403) {
    alert('Admin access required.');
    window.location.href = 'index.html';
    return null;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Small DOM helper: creates an element with a class and (optional) text.
 * Text is always set with textContent, so it can never be parsed as HTML.
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/**
 * Coerces a value to a safe integer id, or null if it isn't one.
 */
function safeId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

async function checkAdminOrRedirect() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = 'login.html';
    return null;
  }
  const user = await res.json();
  if (user.role !== 'admin') {
    alert('Admin access required.');
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

// --- Employee ID lookup ---
// As the admin types an Employee ID (for a Developer/QA account), check
// whether it already belongs to a known developer. If it does, the name
// field is hidden (we already know who this is). If not, the name field
// appears so a new profile can be created in the same step.

let lookupTimeout = null;

async function checkEmployeeId() {
  const employeeId = document.getElementById('newEmployeeId').value.trim();
  const nameField = document.getElementById('newDeveloperName');
  const status = document.getElementById('employeeIdStatus');

  if (!employeeId) {
    status.textContent = '\u00A0';
    nameField.style.display = 'none';
    return;
  }

  try {
    const result = await fetchJSON(`${API_BASE}/developers/lookup?employee_id=${encodeURIComponent(employeeId)}`);
    if (result.found) {
      status.textContent = `found: ${result.developer.name}`;
      nameField.style.display = 'none';
      nameField.value = '';
    } else {
      status.textContent = 'new Employee ID — enter a name below to create their profile';
      nameField.style.display = '';
    }
  } catch (err) {
    status.textContent = '\u00A0';
  }
}

document.getElementById('newEmployeeId').addEventListener('input', () => {
  clearTimeout(lookupTimeout);
  lookupTimeout = setTimeout(() => { void checkEmployeeId(); }, 400); // debounce while typing
});

document.getElementById('newRole').addEventListener('change', () => {
  const role = document.getElementById('newRole').value;
  const employeeIdField = document.getElementById('newEmployeeId');
  const isDevOrQa = role === 'developer' || role === 'qa';
  employeeIdField.style.display = isDevOrQa ? '' : 'none';
  document.getElementById('employeeIdStatus').textContent = '\u00A0';
  document.getElementById('newDeveloperName').style.display = 'none';
});

/**
 * Builds one account row using DOM APIs only (no innerHTML with API data).
 */
function buildUserRow(u) {
  const id = safeId(u.id);
  const role = ALLOWED_ROLES.includes(u.role) ? u.role : '';

  const row = el('div', 'task-row');
  if (id !== null) row.dataset.id = String(id);

  row.appendChild(el('span', 'task-title', u.username));

  const meta = el('span', 'task-meta');
  meta.appendChild(el('span', ('task-priority ' + role).trim(), role));
  meta.appendChild(el('span', '',
      u.developer_name
          ? `linked: ${u.developer_name} (${u.employee_id || ''})`
          : 'linked: —'));
  row.appendChild(meta);

  const actions = el('span', 'task-actions');

  const select = el('select');
  select.dataset.action = 'role-select';
  select.setAttribute('aria-label', 'Change role');
  if (id !== null) select.dataset.id = String(id);
  ROLES.forEach((r) => {
    const opt = new Option(r.label, r.value);
    opt.selected = r.value === role;
    select.appendChild(opt);
  });
  actions.appendChild(select);

  const delBtn = el('button', 'danger', 'Delete');
  delBtn.dataset.action = 'delete';
  if (id !== null) delBtn.dataset.id = String(id);
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

async function loadUsers() {
  const list = document.getElementById('userList');
  try {
    const users = await fetchJSON(`${API_BASE}/users`);
    if (!users) return;

    document.getElementById('userCount').textContent = users.length;
    list.replaceChildren();

    if (users.length === 0) {
      list.appendChild(el('p', 'empty-state', 'No accounts yet.'));
      return;
    }

    users.forEach((u) => list.appendChild(buildUserRow(u)));
  } catch (err) {
    list.replaceChildren(el('p', 'empty-state', 'Could not load accounts.'));
    console.error(err);
  }
}

document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('createFeedback');

  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newRole').value;
  const employee_id = document.getElementById('newEmployeeId').value.trim() || null;
  const developer_name = document.getElementById('newDeveloperName').value.trim() || null;

  feedback.textContent = 'creating…';
  try {
    await fetchJSON(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, employee_id, developer_name }),
    });
    feedback.textContent = `account created for ${username}`;
    e.target.reset();
    document.getElementById('newDeveloperName').style.display = 'none';
    document.getElementById('employeeIdStatus').textContent = '\u00A0';
    await loadUsers();
  } catch (err) {
    feedback.textContent = err.message || 'could not create account';
  }
});

document.getElementById('userList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="delete"]');
  if (!btn) return;

  const id = safeId(btn.dataset.id);
  if (id === null) return;
  if (!confirm('Delete this account? This cannot be undone.')) return;

  try {
    await fetchJSON(`${API_BASE}/users/${id}`, { method: 'DELETE' });
    await loadUsers();
  } catch (err) {
    alert(err.message || 'Could not delete account');
  }
});

document.getElementById('userList').addEventListener('change', async (e) => {
  const select = e.target.closest('select[data-action="role-select"]');
  if (!select) return;

  const id = safeId(select.dataset.id);
  const role = select.value;
  if (id === null || !ALLOWED_ROLES.includes(role)) return;

  try {
    await fetchJSON(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    await loadUsers();
  } catch (err) {
    alert(err.message || 'Could not update role');
    await loadUsers();
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = 'login.html';
});

(async () => {
  const user = await checkAdminOrRedirect();
  if (!user) return;
  document.getElementById('currentUser').textContent = user.username;
  await loadUsers();
})();