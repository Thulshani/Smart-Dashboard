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
  { key: 'burnoutRisk',           label: 'Burnout Risk',            unit: '%', wired: true, inverted: true },
];

// Suggested starter text for the "Send recommendation" prompt — managers
// can edit freely before sending, this is just a helpful default.
const METRIC_TIPS = {
  deliveryReliability: "Let's review your current task load and due dates together — happy to reprioritize if needed.",
  defectPrevention: "Let's build in a bit more testing time before marking tasks done — maybe pair with QA on tricky areas.",
  qualityImpact: "Let's carve out time to add test coverage on recent work and look at what SonarCloud is flagging.",
  technicalDebtExposure: "Let's schedule some time to refactor the flagged files — I can help prioritize which ones matter most.",
  focusStability: "I've noticed you're juggling a few things at once — let's talk about limiting work-in-progress to one task at a time.",
  learningGrowth: "Would a course or certification help this sprint? Happy to suggest a few options if useful.",
  collaborationIndex: "Let's find a PR to review together, or a teammate you could pair with this week.",
  automationStrength: "Let's look at adding a few more automated tests, or dig into any flaky tests together.",
  burnoutRisk: "I've noticed some signs you might be stretched thin — let's talk about redistributing tasks or taking some time to recover.",
};

// Only these task statuses are ever rendered as CSS classes / buttons.
const ALLOWED_STATUSES = ['todo', 'in_progress', 'done'];

// --- Sidebar navigation ---
document.querySelectorAll('.sidebar-link').forEach((link) => {
  link.addEventListener('click', () => {
    if (link.id === 'manageUsersLink') {
      window.location.href = 'admin-users.html';
      return;
    }
    document.querySelectorAll('.sidebar-link').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page-section').forEach((s) => s.classList.remove('active'));
    const target = document.getElementById(`section-${link.dataset.section}`);
    if (target) target.classList.add('active');
  });
});

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });

  if (res.status === 401) {
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
  const user = await res.json();
  if (user.role === 'developer' || user.role === 'qa') {
    window.location.href = 'my-activity.html';
    return null;
  }
  return user;
}

function statusColorFor(score, inverted = false) {
  if (score === null || score === undefined) return null;
  if (inverted) {
    if (score < 40) return 'good';
    if (score < 70) return 'warn';
    return 'bad';
  }
  if (score >= 80) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

/**
 * Coerces a value to a safe integer id, or null if it isn't one.
 * Task ids are integers, so anything else is rejected outright.
 */
function safeId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * XSS-safe metrics renderer.
 * Builds cards with DOM APIs + textContent so API data never goes into innerHTML raw.
 */
function renderMetrics(summary) {
  const grid = document.getElementById('metricsGrid');
  const strip = document.getElementById('pipelineStrip');
  grid.innerHTML = '';
  strip.innerHTML = '';

  METRIC_DEFS.forEach((def) => {
    const data = summary && summary[def.key] ? summary[def.key] : null;

    // Coerce score to a finite number or null — never trust raw API strings for HTML
    let score = null;
    if (data && data.score !== null && data.score !== undefined && data.score !== '') {
      const n = Number(data.score);
      score = Number.isFinite(n) ? n : null;
    }

    const statusClass = statusColorFor(score, def.inverted);

    // Pipeline strip segment
    const seg = document.createElement('span');
    if (statusClass) seg.className = statusClass;
    strip.appendChild(seg);

    // Metric card
    const card = document.createElement('div');
    card.className = 'metric-card' + (def.wired ? '' : ' placeholder');
    if (statusClass) {
      const colorVar =
          statusClass === 'good' ? 'var(--accent-good)'
              : statusClass === 'warn' ? 'var(--accent-warn)'
                  : 'var(--accent-bad)';
      card.style.setProperty('--status-color', colorVar);
    }

    // Label
    const labelEl = document.createElement('p');
    labelEl.className = 'metric-label';
    labelEl.textContent = def.label;
    card.appendChild(labelEl);

    // Value (number only)
    const valueEl = document.createElement('div');
    valueEl.className = 'metric-value';
    if (score === null) {
      valueEl.textContent = '—';
    } else {
      valueEl.textContent = String(score);
      if (def.unit) {
        const unitSpan = document.createElement('span');
        unitSpan.className = 'unit';
        unitSpan.textContent = def.unit;
        valueEl.appendChild(unitSpan);
      }
    }
    card.appendChild(valueEl);

    // Sub text
    const subEl = document.createElement('p');
    subEl.className = 'metric-sub';
    if (!def.wired) {
      subEl.textContent = 'Not built yet';
    } else if (data && data.total !== undefined) {
      const onTime = Number(data.onTime) || 0;
      const total = Number(data.total) || 0;
      subEl.textContent = `${onTime}/${total} on time`;
    } else if (data && data.message) {
      subEl.textContent = String(data.message);
    } else {
      subEl.textContent = '';
    }
    card.appendChild(subEl);

    // Status badge
    if (statusClass) {
      const statusEl = document.createElement('span');
      statusEl.className = 'metric-status';
      statusEl.textContent =
          statusClass === 'good' ? 'on track'
              : statusClass === 'warn' ? 'monitor'
                  : 'at risk';
      card.appendChild(statusEl);
    }

    // Recommend button
    if (dateFilter.developer_id) {
      const recBtn = document.createElement('button');
      recBtn.className = 'rec-btn';
      recBtn.dataset.metric = def.key;
      recBtn.dataset.label = def.label;
      recBtn.textContent = '💡 Recommend';
      card.appendChild(recBtn);
    }

    grid.appendChild(card);
  });
}

function formatDate(d) {
  if (!d) return null;
  return d;
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

const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

/**
 * Builds the action buttons for a task row as real DOM elements.
 * The id is coerced to an integer; nothing from the API is parsed as HTML.
 */
function taskActionButtons(task) {
  const id = safeId(task.id);
  if (id === null) return [];

  const makeBtn = (action, label, extraClass) => {
    const btn = el('button', extraClass || '', label);
    btn.dataset.action = action;
    btn.dataset.id = String(id);
    return btn;
  };

  const buttons = [];
  if (task.status === 'todo') {
    buttons.push(makeBtn('start', 'Start'));
  } else if (task.status === 'in_progress') {
    buttons.push(makeBtn('done', 'Mark done'));
    buttons.push(makeBtn('pause', 'Back to to-do'));
  } else if (task.status === 'done') {
    buttons.push(makeBtn('reopen', 'Reopen'));
  }
  buttons.push(makeBtn('delete', 'Delete', 'danger'));
  return buttons;
}

function renderTasks(tasks) {
  const list = document.getElementById('taskList');
  document.getElementById('taskCount').textContent = tasks.length;
  list.replaceChildren();

  if (tasks.length === 0) {
    list.appendChild(el('p', 'empty-state', 'No tasks yet — add one above to get started.'));
    return;
  }

  tasks.forEach((task) => {
    const rowId = safeId(task.id);
    const status = ALLOWED_STATUSES.includes(task.status) ? task.status : '';
    const priority = ALLOWED_PRIORITIES.includes(task.priority) ? task.priority : '';

    const row = el('div', 'task-row');
    if (rowId !== null) row.dataset.id = String(rowId);

    row.appendChild(el('span', ('task-status-dot ' + status).trim()));
    row.appendChild(el('span', 'task-title' + (status === 'done' ? ' done' : ''), task.title));

    const meta = el('span', 'task-meta');
    meta.appendChild(el('span', ('task-priority ' + priority).trim(), priority));
    if (status === 'in_progress') {
      meta.appendChild(el('span', 'task-inprogress-tag', 'in progress'));
    }
    if (task.due_date) {
      meta.appendChild(el('span', '', `due ${formatDate(task.due_date)}`));
    }
    if (task.assignee_name) {
      meta.appendChild(el('span', '', task.assignee_name));
    }
    row.appendChild(meta);

    const actions = el('span', 'task-actions');
    taskActionButtons(task).forEach((btn) => actions.appendChild(btn));
    row.appendChild(actions);

    list.appendChild(row);
  });
}

// --- Developers ---

async function loadDevelopers() {
  try {
    const developers = await fetchJSON(`${API_BASE}/developers`);
    if (!developers) return;

    const taskSelect = document.getElementById('taskAssignee');
    const growthSelect = document.getElementById('growthAssignee');
    const collabSelect = document.getElementById('collabAssignee');
    const checkinSelect = document.getElementById('checkinAssignee');
    const filterSelect = document.getElementById('filterDeveloper');

    const fillSelect = (select, placeholder) => {
      select.replaceChildren(new Option(placeholder, ''));
      developers.forEach((d) => {
        select.appendChild(new Option(String(d.name), String(d.id)));
      });
    };

    fillSelect(taskSelect, 'Unassigned');
    fillSelect(growthSelect, 'Select your name…');
    fillSelect(collabSelect, 'Select your name…');
    fillSelect(checkinSelect, 'Select your name…');
    fillSelect(filterSelect, 'All developers');
  } catch (err) {
    console.error('Could not load developers list:', err);
  }
}

let dateFilter = { from: '', to: '', developer_id: '' };

function buildSummaryUrl() {
  const params = new URLSearchParams();
  if (dateFilter.from) params.set('from', dateFilter.from);
  if (dateFilter.to) params.set('to', dateFilter.to);
  if (dateFilter.developer_id) params.set('developer_id', dateFilter.developer_id);
  const qs = params.toString();
  return `${API_BASE}/metrics/summary${qs ? '?' + qs : ''}`;
}

async function loadAll() {
  try {
    const [summary, tasks] = await Promise.all([
      fetchJSON(buildSummaryUrl()),
      fetchJSON(`${API_BASE}/tasks`),
    ]);
    if (!summary) return;

    renderMetrics(summary);
    renderTasks(tasks || []);
    document.getElementById('lastUpdated').textContent =
        'updated ' + new Date().toLocaleTimeString();

    const growthScore = summary.learningGrowth && summary.learningGrowth.score;
    const growthEl = document.getElementById('growthScoreLabel');
    if (growthEl) {
      growthEl.textContent =
          growthScore === null || growthScore === undefined ? '—' : `${Number(growthScore)}%`;
    }

    const collabScore = summary.collaborationIndex && summary.collaborationIndex.score;
    const collabEl = document.getElementById('collabScoreLabel');
    if (collabEl) {
      collabEl.textContent =
          collabScore === null || collabScore === undefined ? '—' : `${Number(collabScore)}%`;
    }
  } catch (err) {
    document.getElementById('lastUpdated').textContent = 'connection error';
    console.error(err);
  }
}

// --- Event handlers ---

document.getElementById('metricsGrid').addEventListener('click', async (e) => {
  const btn = e.target.closest('.rec-btn');
  if (!btn) return;

  if (!dateFilter.developer_id) {
    alert('Select a specific developer in the filter above first.');
    return;
  }

  const metricKey = btn.dataset.metric;
  const label = btn.dataset.label;
  const suggested = METRIC_TIPS[metricKey] || '';
  const message = window.prompt(`Send a recommendation for ${label}:`, suggested);
  if (!message || !message.trim()) return;

  try {
    await fetchJSON(`${API_BASE}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        developer_id: dateFilter.developer_id,
        metric_key: metricKey,
        message: message.trim(),
      }),
    });
    alert('Recommendation sent.');
  } catch (err) {
    alert(err.message || 'Could not send recommendation');
  }
});

document.getElementById('dateFilterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  dateFilter.from = document.getElementById('filterFrom').value;
  dateFilter.to = document.getElementById('filterTo').value;
  dateFilter.developer_id = document.getElementById('filterDeveloper').value;
  void loadAll();
});

document.getElementById('clearFilterBtn').addEventListener('click', () => {
  dateFilter = { from: '', to: '', developer_id: '' };
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  document.getElementById('filterDeveloper').value = '';
  void loadAll();
});

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  const assignee_id = document.getElementById('taskAssignee').value || null;
  const priority = document.getElementById('taskPriority').value;
  const due_date = document.getElementById('taskDueDate').value || null;

  if (!title) return;

  try {
    await fetchJSON(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, assignee_id, priority, due_date }),
    });
    e.target.reset();
    document.getElementById('taskPriority').value = 'medium';
    await loadAll();
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('taskList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const id = safeId(btn.dataset.id);
  const action = btn.dataset.action;
  if (id === null) return;

  try {
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
    await loadAll();
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (err) {
    console.error(err);
  }
  window.location.href = 'login.html';
});

// --- Defect Radar ---

function bugSeverityIcon(severity) {
  if (severity === 'high') return '🔴';
  if (severity === 'low') return '🟢';
  return '🟡';
}

async function refreshBugRecent() {
  const list = document.getElementById('bugRecentList');
  try {
    const bugs = await fetchJSON(`${API_BASE}/bugs`);
    list.replaceChildren();
    if (!bugs || bugs.length === 0) {
      list.appendChild(el('p', 'empty-state', 'No bugs logged yet.'));
      return;
    }
    bugs.slice(0, 5).forEach((b) => {
      const item = el('div', 'growth-recent-item');
      item.appendChild(el('span', '', bugSeverityIcon(b.severity)));
      item.appendChild(el('span', 'growth-recent-item-title',
          `${b.title == null ? '' : b.title} ${b.status === 'resolved' ? '(resolved)' : ''}`.trim()));
      item.appendChild(el('span', 'growth-recent-item-time', b.reported_by_name || ''));
      list.appendChild(item);
    });
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('bugForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const outcome = e.submitter ? e.submitter.dataset.outcome : null;
  const title = document.getElementById('bugTitle').value.trim();
  const description = document.getElementById('bugDescription').value.trim();
  const severity = document.getElementById('bugSeverity').value;
  const feedback = document.getElementById('radarFeedback');

  if (!outcome || !title) {
    feedback.textContent = 'enter a bug title first';
    return;
  }

  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        severity,
        found_in_testing: outcome === 'caught' ? 1 : 0,
      }),
    });
    feedback.textContent = outcome === 'caught' ? 'logged — caught before release' : 'logged — escaped to prod';
    document.getElementById('bugTitle').value = '';
    document.getElementById('bugDescription').value = '';
    document.getElementById('bugSeverity').value = 'medium';
    await refreshBugRecent();
    await refreshDefectRadar();
    await loadAll();
  } catch (err) {
    feedback.textContent = err.message || 'could not log — try again';
  }
});

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
    const score = Number(data.score) || 0;
    fill.style.width = `${score}%`;
    label.textContent = `${score}%`;
  } catch (err) {
    label.textContent = '—';
    console.error(err);
  }
}

// --- Growth Log ---

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
    list.replaceChildren();
    if (!achievements || achievements.length === 0) {
      list.appendChild(el('p', 'empty-state', 'No achievements logged yet.'));
      return;
    }
    achievements.slice(0, 3).forEach((a) => {
      const item = el('div', 'growth-recent-item');
      item.appendChild(el('span', '', achievementIcon(a.type)));
      item.appendChild(el('span', 'growth-recent-item-title', a.title || a.type));
      item.appendChild(el('span', 'growth-recent-item-time', timeAgo(a.created_at)));
      list.appendChild(item);
    });
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('growthForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitter = e.submitter;
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
    await refreshGrowthRecent();
    await loadAll();
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }
});

// --- Collaboration Log ---

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
    await loadAll();
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }
}

document.querySelectorAll('.collab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    void logCollaboration(btn.dataset.type);
  });
});

// --- Wellbeing Check-in ---

async function logCheckin(loadRating) {
  const developer_id = document.getElementById('checkinAssignee').value;
  const feedback = document.getElementById('checkinFeedback');

  if (!developer_id) {
    feedback.textContent = 'select your name first';
    return;
  }

  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id, load_rating: loadRating }),
    });
    feedback.textContent = 'thanks for checking in';
    await loadAll();
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }
}

document.querySelectorAll('.checkin-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    void logCheckin(Number(btn.dataset.rating));
  });
});

// Require a logged-in session before showing any data
(async () => {
  const user = await checkAuthOrRedirect();
  if (!user) return;
  document.getElementById('currentUser').textContent = user.username;
  if (user.role === 'admin') {
    document.getElementById('manageUsersLink').style.display = 'flex';
  }
  await loadDevelopers();
  await Promise.all([
    loadAll(),
    refreshDefectRadar(),
    refreshGrowthRecent(),
  ]);
  setInterval(() => { void loadAll(); }, 15000);
  setInterval(() => { void refreshDefectRadar(); }, 15000);
  setInterval(() => { void refreshGrowthRecent(); }, 15000);
})();