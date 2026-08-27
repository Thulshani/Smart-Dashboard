// app.js
// Vanilla JS — no build step needed. Talks to the same server that serves
// this page, so API_BASE is just relative paths.

const API_BASE = '/api';

// Metrics currently wired up on the backend, plus placeholders for what's
// still to come — keeps the dashboard's final shape visible from day one.
const METRIC_DEFS = [
  { key: 'deliveryReliability',   label: 'Delivery Reliability',    unit: '%', wired: true },
  { key: 'defectPrevention',      label: 'Defect Prevention',       unit: '%', wired: true },
  { key: 'qualityImpact',         label: 'Quality Impact',          unit: '',  wired: true },
  { key: 'technicalDebtExposure', label: 'Technical Debt Exposure', unit: '',  wired: true },
  { key: 'focusStability',        label: 'Focus Stability',         unit: '%', wired: true },
  { key: 'learningGrowth',        label: 'Learning & Growth',       unit: '',  wired: true },
  { key: 'collaborationIndex',    label: 'Collaboration Index',     unit: '',  wired: true },
  { key: 'automationStrength',    label: 'Automation Strength',     unit: '',  wired: true },
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

// Returns the action buttons for a task row, based on its current status.
// todo -> in_progress -> done, with the ability to step back at each stage.
function taskActionsFor(task) {
  const buttons = [];

  if (task.status === 'todo') {
    buttons.push(`<button data-action="start" data-id="${task.id}">Start</button>`);
  } else if (task.status === 'in_progress') {
    buttons.push(`<button data-action="done" data-id="${task.id}">Mark done</button>`);
    buttons.push(`<button data-action="pause" data-id="${task.id}">Back to to-do</button>`);
  } else if (task.status === 'done') {
    buttons.push(`<button data-action="reopen" data-id="${task.id}">Reopen</button>`);
  }

  buttons.push(`<button data-action="delete" data-id="${task.id}" class="danger">Delete</button>`);
  return buttons.join('');
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
        ${task.status === 'in_progress' ? '<span class="task-inprogress-tag">in progress</span>' : ''}
        ${task.due_date ? `<span>due ${formatDate(task.due_date)}</span>` : ''}
        ${task.assignee_name ? `<span>${escapeHtml(task.assignee_name)}</span>` : ''}
      </span>
      <span class="task-actions">
        ${taskActionsFor(task)}
      </span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Developers ---
// Populates the three assignee dropdowns (task form, growth log, collab
// log) once on load. Developers list rarely changes mid-session, so this
// doesn't need to be part of the 15s polling loop.

async function loadDevelopers() {
  try {
    const developers = await fetchJSON(`${API_BASE}/developers`);
    if (!developers) return;

    const taskSelect = document.getElementById('taskAssignee');
    const growthSelect = document.getElementById('growthAssignee');
    const collabSelect = document.getElementById('collabAssignee');

    const options = developers.map((d) =>
        `<option value="${d.id}">${escapeHtml(d.name)}</option>`
    ).join('');

    taskSelect.innerHTML = '<option value="">Unassigned</option>' + options;
    growthSelect.innerHTML = '<option value="">Select your name…</option>' + options;
    collabSelect.innerHTML = '<option value="">Select your name…</option>' + options;
  } catch (err) {
    console.error('Could not load developers list:', err);
  }
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

    const growthScore = summary.learningGrowth && summary.learningGrowth.score;
    document.getElementById('growthScoreLabel').textContent =
        growthScore === null || growthScore === undefined ? '—' : `${growthScore}%`;

    const collabScore = summary.collaborationIndex && summary.collaborationIndex.score;
    document.getElementById('collabScoreLabel').textContent =
        collabScore === null || collabScore === undefined ? '—' : `${collabScore}%`;
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
  } else if (action === 'start') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
  } else if (action === 'done') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
  } else if (action === 'pause') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'todo' }),
    });
  } else if (action === 'reopen') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
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

// --- Growth Log ---
// Same one-tap-logging spirit as Defect Radar: type what you finished,
// tap the category, done. No multi-field form to slow people down.

function achievementIcon(type) {
  if (type === 'course') return '📘';
  if (type === 'certification') return '🎓';
  return '🛠';
}

function timeAgo(isoString) {
  const then = new Date(isoString.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function refreshGrowthRecent() {
  const list = document.getElementById('growthRecentList');
  try {
    const achievements = await fetchJSON(`${API_BASE}/achievements`);
    if (!achievements || achievements.length === 0) {
      list.innerHTML = '<p class="empty-state">No achievements logged yet.</p>';
      return;
    }
    list.innerHTML = achievements.slice(0, 3).map((a) => `
      <div class="growth-recent-item">
        <span>${achievementIcon(a.type)}</span>
        <span class="growth-recent-item-title">${escapeHtml(a.title || a.type)}</span>
        <span class="growth-recent-item-time">${timeAgo(a.created_at)}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('growthForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitter = e.submitter; // the specific button that was clicked
  const type = submitter ? submitter.dataset.type : null;
  const developer_id = document.getElementById('growthAssignee').value;
  const title = document.getElementById('growthTitle').value.trim();
  const feedback = document.getElementById('growthFeedback');

  if (!type || !developer_id || !title) {
    feedback.textContent = 'enter your developer ID and a title first';
    return;
  }

  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/achievements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id, type, title }),
    });
    feedback.textContent = `logged — ${type}`;
    document.getElementById('growthTitle').value = '';
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }

  await refreshGrowthRecent();
  loadAll();
});

// --- Collaboration Log ---
// Same one-tap pattern as Defect Radar: select your name once, then tap
// whichever type of collaboration just happened. No title needed here.
async function logCollaboration(type) {
  const developer_id = document.getElementById('collabAssignee').value;
  const feedback = document.getElementById('collabFeedback');
  if (!developer_id) {
    feedback.textContent = 'select your name first';
    return;
  }
  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/collaborations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id, type }),
    });
    feedback.textContent = `logged — ${type}`;
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }
  loadAll();
}
document.querySelectorAll('.collab-btn').forEach((btn) => {
  btn.addEventListener('click', () => logCollaboration(btn.dataset.type));
});

// Require a logged-in session before showing any data
(async () => {
  const user = await checkAuthOrRedirect();
  if (!user) return; // already redirecting to login.html
  document.getElementById('currentUser').textContent = user.username;
  loadDevelopers();
  loadAll();
  refreshDefectRadar();
  refreshGrowthRecent();
  setInterval(loadAll, 15000);
  setInterval(refreshDefectRadar, 15000);
  setInterval(refreshGrowthRecent, 15000);
})();