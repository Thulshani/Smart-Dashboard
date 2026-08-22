// app.js
// Vanilla JS — no build step needed. Talks to the same server that serves
// this page, so API_BASE is just relative paths.

const API_BASE = '/api';

// Metrics currently wired up on the backend, plus placeholders for what's
// still to come — keeps the dashboard's final shape visible from day one.
const METRIC_DEFS = [
  { key: 'deliveryReliability', label: 'Delivery Reliability', unit: '%', wired: true },
  { key: 'defectPrevention',    label: 'Defect Prevention',    unit: '%', wired: true },
  { key: 'qualityImpact',       label: 'Quality Impact',       unit: '',  wired: false },
  { key: 'focusStability',      label: 'Focus Stability',      unit: '%', wired: false },
];

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });

  if (res.status === 401) {
    // Session missing or expired — bounce to login
    window.location.href = 'login.html';
    return null;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function checkAuthOrRedirect() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = 'login.html';
    return null;
  }
  return res.json();
}

function statusColorFor(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

function renderMetrics(summary) {
  const grid = document.getElementById('metricsGrid');
  const strip = document.getElementById('pipelineStrip');
  grid.innerHTML = '';
  strip.innerHTML = '';

  METRIC_DEFS.forEach(def => {
    const data = summary[def.key];
    const score = data ? data.score : null;
    const statusClass = statusColorFor(score);

    // Pipeline strip segment
    const seg = document.createElement('span');
    if (statusClass) seg.className = statusClass;
    strip.appendChild(seg);

    // Metric card
    const card = document.createElement('div');
    card.className = 'metric-card' + (def.wired ? '' : ' placeholder');
    if (statusClass) {
      const colorVar = statusClass === 'good' ? 'var(--accent-good)'
                      : statusClass === 'warn' ? 'var(--accent-warn)'
                      : 'var(--accent-bad)';
      card.style.setProperty('--status-color', colorVar);
    }

    const valueDisplay = score === null || score === undefined
      ? '—'
      : `${score}<span class="unit">${def.unit}</span>`;

    const subText = !def.wired
      ? 'Not built yet'
      : (data && data.total !== undefined ? `${data.onTime}/${data.total} on time` : (data && data.message) || '');

    card.innerHTML = `
      <p class="metric-label">${def.label}</p>
      <div class="metric-value">${valueDisplay}</div>
      <p class="metric-sub">${subText}</p>
      ${statusClass ? `<span class="metric-status">${statusClass === 'good' ? 'on track' : statusClass === 'warn' ? 'monitor' : 'at risk'}</span>` : ''}
    `;
    grid.appendChild(card);
  });
}

function formatDate(d) {
  if (!d) return null;
  return d;
}

function renderTasks(tasks) {
  const list = document.getElementById('taskList');
  document.getElementById('taskCount').textContent = tasks.length;

  if (tasks.length === 0) {
    list.innerHTML = '<p class="empty-state">No tasks yet — add one above to get started.</p>';
    return;
  }

  list.innerHTML = tasks.map(task => `
    <div class="task-row" data-id="${task.id}">
      <span class="task-status-dot ${task.status}"></span>
      <span class="task-title ${task.status === 'done' ? 'done' : ''}">${escapeHtml(task.title)}</span>
      <span class="task-meta">
        <span class="task-priority ${task.priority}">${task.priority}</span>
        ${task.due_date ? `<span>due ${formatDate(task.due_date)}</span>` : ''}
        ${task.assignee_name ? `<span>${escapeHtml(task.assignee_name)}</span>` : ''}
      </span>
      <span class="task-actions">
        ${task.status !== 'done'
          ? `<button data-action="done" data-id="${task.id}">Mark done</button>`
          : `<button data-action="reopen" data-id="${task.id}">Reopen</button>`}
        <button data-action="delete" data-id="${task.id}" class="danger">Delete</button>
      </span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadAll() {
  try {
    const [summary, tasks] = await Promise.all([
      fetchJSON(`${API_BASE}/metrics/summary`),
      fetchJSON(`${API_BASE}/tasks`),
    ]);
    renderMetrics(summary);
    renderTasks(tasks);
    document.getElementById('lastUpdated').textContent =
      'updated ' + new Date().toLocaleTimeString();
  } catch (err) {
    document.getElementById('lastUpdated').textContent = 'connection error';
    console.error(err);
  }
}

// --- Event handlers ---

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  const assignee_id = document.getElementById('taskAssignee').value || null;
  const priority = document.getElementById('taskPriority').value;
  const due_date = document.getElementById('taskDueDate').value || null;

  if (!title) return;

  await fetchJSON(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, assignee_id, priority, due_date }),
  });

  e.target.reset();
  document.getElementById('taskPriority').value = 'medium';
  loadAll();
});

document.getElementById('taskList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  } else if (action === 'done') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
  } else if (action === 'reopen') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'todo' }),
    });
  }

  loadAll();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = 'login.html';
});

// --- Defect Radar ---
// One-tap logging instead of a form: a bug is caught in the moment it's
// found, so the fastest possible input wins over a "correct" data-entry form.

async function logBug(foundInTesting) {
  const feedback = document.getElementById('radarFeedback');
  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ found_in_testing: foundInTesting ? 1 : 0 }),
    });
    feedback.textContent = foundInTesting
      ? 'logged — caught before release'
      : 'logged — escaped to prod';
  } catch (err) {
    feedback.textContent = 'could not log bug — try again';
    console.error(err);
  }
  await refreshDefectRadar();
  loadAll();
}

async function refreshDefectRadar() {
  const fill = document.getElementById('radarBarFill');
  const label = document.getElementById('radarBarLabel');
  try {
    const data = await fetchJSON(`${API_BASE}/metrics/defect-prevention`);
    if (!data || data.score === null || data.score === undefined) {
      fill.style.width = '0%';
      label.textContent = '—';
      return;
    }
    fill.style.width = `${data.score}%`;
    label.textContent = `${data.score}%`;
  } catch (err) {
    label.textContent = '—';
    console.error(err);
  }
}

document.getElementById('logCaughtBtn').addEventListener('click', () => logBug(true));
document.getElementById('logEscapedBtn').addEventListener('click', () => logBug(false));

// Require a logged-in session before showing any data
(async () => {
  const user = await checkAuthOrRedirect();
  if (!user) return; // already redirecting to login.html
  document.getElementById('currentUser').textContent = user.username;
  loadAll();
  refreshDefectRadar();
  setInterval(loadAll, 15000);
  setInterval(refreshDefectRadar, 15000);
})();
