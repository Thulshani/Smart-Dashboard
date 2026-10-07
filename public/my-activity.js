// my-activity.js
// Developer/QA-only page — logging only, no metrics dashboard visible.
// developer_id is never sent from here; the backend derives it from the
// logged-in session (see routes/achievements.js, collaborations.js,
// checkins.js), so there's nothing to select or tamper with.

const API_BASE = '/api';
let currentUser = null;

// --- Sidebar navigation ---
document.querySelectorAll('.sidebar-link').forEach((link) => {
    link.addEventListener('click', () => {
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

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

const METRIC_LABELS = {
    deliveryReliability: 'Delivery Reliability',
    defectPrevention: 'Defect Prevention',
    qualityImpact: 'Quality Impact',
    technicalDebtExposure: 'Technical Debt Exposure',
    focusStability: 'Focus Stability',
    learningGrowth: 'Learning & Growth',
    collaborationIndex: 'Collaboration Index',
    automationStrength: 'Automation Strength',
    burnoutRisk: 'Burnout Risk',
};

function recTimeAgo(isoString) {
    const then = new Date(isoString.replace(' ', 'T') + 'Z');
    const mins = Math.floor((Date.now() - then.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

async function loadRecommendations() {
    const list = document.getElementById('recommendationsList');
    try {
        const recs = await fetchJSON(`${API_BASE}/recommendations`);
        document.getElementById('recCount').textContent = (recs || []).length;

        if (!recs || recs.length === 0) {
            list.innerHTML = '<p class="empty-state">No notes yet.</p>';
            return;
        }

        list.innerHTML = recs.map((r) => `
      <div class="task-row">
        <span class="task-title">${METRIC_LABELS[r.metric_key] || r.metric_key}</span>
        <span class="task-meta">
          <span>${escapeHtml(r.message)}</span>
        </span>
        <span class="task-meta">
          <span>from ${escapeHtml(r.manager_username || 'your manager')} — ${recTimeAgo(r.created_at)}</span>
        </span>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
    }
}

async function checkAuthAndRole() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
        window.location.href = 'login.html';
        return null;
    }
    const user = await res.json();
    // Managers/Admins belong on the full dashboard, not here
    if (user.role === 'manager' || user.role === 'admin') {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

// --- My Tasks ---

async function loadMyTasks() {
    const list = document.getElementById('taskList');
    try {
        const tasks = await fetchJSON(`${API_BASE}/tasks`);
        if (!tasks) return;
        const mine = tasks.filter((t) => t.assignee_id === currentUser.developer_id);

        document.getElementById('taskCount').textContent = mine.length;

        if (mine.length === 0) {
            list.innerHTML = '<p class="empty-state">No tasks assigned yet.</p>';
            return;
        }

        list.innerHTML = mine.map((task) => `
      <div class="task-row" data-id="${task.id}">
        <span class="task-status-dot ${task.status}"></span>
        <span class="task-title ${task.status === 'done' ? 'done' : ''}">${escapeHtml(task.title)}</span>
        <span class="task-meta">
          <span class="task-priority ${task.priority}">${task.priority}</span>
          ${task.due_date ? `<span>due ${task.due_date}</span>` : ''}
        </span>
        <span class="task-actions">
          ${task.status === 'todo' ? `<button data-action="start" data-id="${task.id}">Start</button>` : ''}
          ${task.status === 'in_progress' ? `<button data-action="done" data-id="${task.id}">Mark done</button>` : ''}
          ${task.status === 'done' ? `<button data-action="reopen" data-id="${task.id}">Reopen</button>` : ''}
        </span>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('taskList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const statusMap = { start: 'in_progress', done: 'done', reopen: 'in_progress' };
    try {
        await fetchJSON(`${API_BASE}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: statusMap[btn.dataset.action] }),
        });
        await loadMyTasks();
    } catch (err) {
        console.error(err);
    }
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
        const mine = (bugs || []).filter((b) => b.reported_by === currentUser.developer_id);
        if (mine.length === 0) {
            list.innerHTML = '<p class="empty-state">No bugs logged yet.</p>';
            return;
        }
        list.innerHTML = mine.slice(0, 5).map((b) => `
      <div class="growth-recent-item">
        <span>${bugSeverityIcon(b.severity)}</span>
        <span class="growth-recent-item-title">${escapeHtml(b.title)} ${b.status === 'resolved' ? '(resolved)' : ''}</span>
        <span class="growth-recent-item-time">${timeAgo(b.created_at)}</span>
      </div>
    `).join('');
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
    } catch (err) {
        feedback.textContent = err.message || 'could not log — try again';
    }
});

// --- Growth Log ---

function achievementIcon(type) {
    if (type === 'course') return '📘';
    if (type === 'certification') return '🎓';
    return '🛠';
}

function timeAgo(isoString) {
    const then = new Date(isoString.replace(' ', 'T') + 'Z');
    const mins = Math.floor((Date.now() - then.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

async function refreshGrowthRecent() {
    const list = document.getElementById('growthRecentList');
    try {
        const achievements = await fetchJSON(`${API_BASE}/achievements`);
        const mine = (achievements || []).filter((a) => a.developer_id === currentUser.developer_id);
        if (mine.length === 0) {
            list.innerHTML = '<p class="empty-state">No achievements logged yet.</p>';
            return;
        }
        list.innerHTML = mine.slice(0, 3).map((a) => `
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
    const submitter = e.submitter;
    const type = submitter ? submitter.dataset.type : null;
    const title = document.getElementById('growthTitle').value.trim();
    const feedback = document.getElementById('growthFeedback');

    if (!type || !title) {
        feedback.textContent = 'enter a title first';
        return;
    }

    feedback.textContent = 'logging…';
    try {
        await fetchJSON(`${API_BASE}/achievements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, title }),
        });
        feedback.textContent = `logged — ${type}`;
        document.getElementById('growthTitle').value = '';
        await refreshGrowthRecent();
    } catch (err) {
        feedback.textContent = err.message || 'could not log';
    }
});

// --- Wellbeing Check-in ---

async function logCheckin(loadRating) {
    const feedback = document.getElementById('checkinFeedback');
    feedback.textContent = 'logging…';
    try {
        await fetchJSON(`${API_BASE}/checkins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ load_rating: loadRating }),
        });
        feedback.textContent = 'thanks for checking in';
    } catch (err) {
        feedback.textContent = err.message || 'could not log';
    }
}

document.querySelectorAll('.checkin-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        void logCheckin(Number(btn.dataset.rating));
    });
});

// --- My Overview (home) ---

function isThisMonth(isoString) {
    const d = new Date(isoString.replace(' ', 'T') + 'Z');
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

async function updateOverview() {
    try {
        const status = await fetchJSON(`${API_BASE}/time-logs/status`);
        document.getElementById('ovClockStatus').textContent = status?.clockedIn ? 'Clocked in' : 'Clocked out';
        document.getElementById('ovClockElapsed').textContent =
            status?.clockedIn && status.openEntry
                ? `Since ${new Date(status.openEntry.start_time).toLocaleTimeString()}`
                : '\u00A0';

        const tasks = await fetchJSON(`${API_BASE}/tasks`);
        const mineTasks = (tasks || []).filter((t) => t.assignee_id === currentUser.developer_id);
        const inProgress = mineTasks.filter((t) => t.status === 'in_progress').length;
        document.getElementById('ovTaskCount').textContent = mineTasks.length;
        document.getElementById('ovTaskInProgress').textContent = `${inProgress} in progress`;

        const achievements = await fetchJSON(`${API_BASE}/achievements`);
        const mineAchievements = (achievements || []).filter(
            (a) => a.developer_id === currentUser.developer_id && isThisMonth(a.created_at)
        );
        document.getElementById('ovAchievementCount').textContent = mineAchievements.length;

        const recs = await fetchJSON(`${API_BASE}/recommendations`);
        document.getElementById('ovRecCount').textContent = (recs || []).length;
    } catch (err) {
        console.error('Could not update overview:', err);
    }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
        console.error(err);
    }
    window.location.href = 'login.html';
});

// --- Time Tracker ---

let isClockedIn = false;
let clockedInSince = null;
let elapsedTimerId = null;

function formatDuration(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
}

function formatElapsed(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function startElapsedTimer() {
    stopElapsedTimer();
    const elapsedEl = document.getElementById('clockElapsed');

    function tick() {
        if (!clockedInSince) return;
        const ms = Date.now() - clockedInSince.getTime();
        elapsedEl.textContent = `Elapsed: ${formatElapsed(ms)}`;
    }

    tick();
    elapsedTimerId = setInterval(tick, 1000);
}

function stopElapsedTimer() {
    if (elapsedTimerId) {
        clearInterval(elapsedTimerId);
        elapsedTimerId = null;
    }
    document.getElementById('clockElapsed').textContent = '\u00A0';
}

async function refreshClockStatus() {
    const btn = document.getElementById('clockToggleBtn');
    const label = document.getElementById('clockToggleLabel');
    const statusLabel = document.getElementById('clockStatusLabel');

    try {
        const status = await fetchJSON(`${API_BASE}/time-logs/status`);
        isClockedIn = status.clockedIn;

        if (isClockedIn) {
            label.textContent = 'Clock out';
            btn.classList.remove('caught');
            btn.classList.add('escaped');
            statusLabel.textContent = 'clocked in';
            clockedInSince = new Date(status.openEntry.start_time);
            startElapsedTimer();
        } else {
            label.textContent = 'Clock in';
            btn.classList.remove('escaped');
            btn.classList.add('caught');
            statusLabel.textContent = 'clocked out';
            clockedInSince = null;
            stopElapsedTimer();
        }
    } catch (err) {
        label.textContent = 'Clock in';
        console.error(err);
    }
}

async function refreshTimeLogRecent() {
    const list = document.getElementById('timeLogRecentList');
    try {
        const logs = await fetchJSON(`${API_BASE}/time-logs`);
        const mine = (logs || []).filter((l) => l.developer_id === currentUser.developer_id && l.hours_worked !== null);
        if (mine.length === 0) {
            list.innerHTML = '<p class="empty-state">No completed time logs yet.</p>';
            return;
        }
        list.innerHTML = mine.slice(0, 5).map((l) => `
      <div class="growth-recent-item">
        <span>🕒</span>
        <span class="growth-recent-item-title">${l.work_date} — ${formatDuration(l.hours_worked)}</span>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('clockToggleBtn').addEventListener('click', async () => {
    const feedback = document.getElementById('clockFeedback');
    feedback.textContent = isClockedIn ? 'clocking out…' : 'clocking in…';
    try {
        await fetchJSON(`${API_BASE}/time-logs/${isClockedIn ? 'clock-out' : 'clock-in'}`, {
            method: 'POST',
        });
        feedback.textContent = isClockedIn ? 'clocked out — have a good rest!' : 'clocked in — have a good session!';
        await refreshClockStatus();
        await refreshTimeLogRecent();
    } catch (err) {
        feedback.textContent = err.message || 'something went wrong';
    }
});

// --- Startup ---
(async () => {
    const user = await checkAuthAndRole();
    if (!user) return;
    currentUser = user;
    document.getElementById('currentUser').textContent = user.username;

    await Promise.all([
        loadMyTasks(),
        refreshGrowthRecent(),
        refreshClockStatus(),
        refreshTimeLogRecent(),
        loadRecommendations(),
        refreshBugRecent(),
        updateOverview(),
    ]);

    setInterval(() => { void loadMyTasks(); }, 15000);
    setInterval(() => { void updateOverview(); }, 15000);
})();