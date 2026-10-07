// admin-users.js
// Admin-only screen for creating and managing team accounts. If a
// non-admin somehow lands here, the backend will reject every API call
// with 403 anyway (see middleware/requireRole.js) — but we also bounce
// them straight back to the dashboard for a cleaner experience.

const API_BASE = '/api';

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
  lookupTimeout = setTimeout(checkEmployeeId, 400); // debounce while typing
});

document.getElementById('newRole').addEventListener('change', () => {
  const role = document.getElementById('newRole').value;
  const employeeIdField = document.getElementById('newEmployeeId');
  const isDevOrQa = role === 'developer' || role === 'qa';
  employeeIdField.style.display = isDevOrQa ? '' : 'none';
  document.getElementById('employeeIdStatus').textContent = '\u00A0';
  document.getElementById('newDeveloperName').style.display = 'none';
});

async function loadUsers() {
  const list = document.getElementById('userList');
  try {
    const users = await fetchJSON(`${API_BASE}/users`);
    if (!users) return;

    document.getElementById('userCount').textContent = users.length;

    if (users.length === 0) {
      list.innerHTML = '<p class="empty-state">No accounts yet.</p>';
      return;
    }

    list.innerHTML = users.map((u) => `
      <div class="task-row" data-id="${u.id}">
        <span class="task-title">${escapeHtml(u.username)}</span>
        <span class="task-meta">
          <span class="task-priority ${u.role}">${u.role}</span>
          <span>${u.developer_name ? `linked: ${escapeHtml(u.developer_name)} (${escapeHtml(u.employee_id || '')})` : 'linked: —'}</span>
        </span>
        <span class="task-actions">
          <select data-action="role-select" data-id="${u.id}">
            <option value="developer" ${u.role === 'developer' ? 'selected' : ''}>Developer</option>
            <option value="qa" ${u.role === 'qa' ? 'selected' : ''}>QA</option>
            <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          <button data-action="delete" data-id="${u.id}" class="danger">Delete</button>
        </span>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="empty-state">Could not load accounts.</p>';
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
    loadUsers();
  } catch (err) {
    feedback.textContent = err.message || 'could not create account';
  }
});

document.getElementById('userList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="delete"]');
  if (!btn) return;

  const id = btn.dataset.id;
  if (!confirm('Delete this account? This cannot be undone.')) return;

  await fetchJSON(`${API_BASE}/users/${id}`, { method: 'DELETE' });
  loadUsers();
});

document.getElementById('userList').addEventListener('change', async (e) => {
  const select = e.target.closest('select[data-action="role-select"]');
  if (!select) return;

  const id = select.dataset.id;
  const role = select.value;

  await fetchJSON(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  loadUsers();
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