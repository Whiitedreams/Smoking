function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type === 'success' ? 'toast-success' : 'toast-error') + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}
function showLoginTab(tab) {
  document.getElementById('tab-returning').classList.toggle('hidden', tab !== 'returning');
  document.getElementById('tab-first').classList.toggle('hidden', tab !== 'first');
  document.querySelectorAll('#page-login .tab').forEach((el, i) => el.classList.toggle('active', (tab === 'returning' && i === 0) || (tab === 'first' && i === 1)));
}
function showDashTab(tab) {
  document.getElementById('dash-rank').classList.toggle('hidden', tab !== 'rank');
  document.getElementById('dash-prizes').classList.toggle('hidden', tab !== 'prizes');
  document.querySelectorAll('#page-dashboard .tab').forEach((el, i) => el.classList.toggle('active', (tab === 'rank' && i === 0) || (tab === 'prizes' && i === 1)));
}
function enterDashboard(username, isAdmin) {
  document.getElementById('page-login').classList.add('hidden');
  document.getElementById('page-dashboard').classList.remove('hidden');
  document.getElementById('dashboard-user').textContent = '👤 ' + username;
  showToast('Bienvenue, ' + username + ' !', 'success');
  loadLeaderboard();
  loadPrizes();
  if (isAdmin) {
    document.getElementById('admin-card').classList.remove('hidden');
    loadAdminCodes();
  }
}
function backToLogin() {
  document.getElementById('page-dashboard').classList.add('hidden');
  document.getElementById('page-login').classList.remove('hidden');
  document.getElementById('admin-card').classList.add('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  showLoginTab('returning');
  showDashTab('rank');
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  if (!username || !password) { showToast('Remplis tous les champs', 'error'); return; }
  try {
    const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username, password}) });
    const data = await res.json();
    if (data.success) { checkSession(); }
    else { showToast(data.error || 'Erreur', 'error'); }
  } catch (e) { showToast('Erreur serveur', 'error'); }
}

async function doActivate() {
  const code = document.getElementById('activate-code').value.trim();
  const username = document.getElementById('activate-user').value.trim();
  const password = document.getElementById('activate-pass').value.trim();
  if (!code || !username || !password) { showToast('Remplis tous les champs', 'error'); return; }
  try {
    const res = await fetch('/api/activate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({code, username, password}) });
    const data = await res.json();
    if (data.success) { checkSession(); }
    else { showToast(data.error || 'Erreur', 'error'); }
  } catch (e) { showToast('Erreur serveur', 'error'); }
}

async function doLogout() {
  try { await fetch('/api/logout', {method:'POST'}); backToLogin(); showToast('Déconnecté', 'success'); }
  catch (e) { showToast('Erreur', 'error'); }
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    const tbody = document.querySelector('#leaderboard-table tbody');
    tbody.innerHTML = '';
    data.forEach((row, i) => {
      const rank = i + 1;
      let cls = '', badge = '';
      if (rank === 1) { cls = 'rank-1'; badge = '<span class="badge badge-gold">Top 1</span>'; }
      else if (rank === 2) { cls = 'rank-2'; badge = '<span class="badge badge-silver">Top 2</span>'; }
      else if (rank === 3) { cls = 'rank-3'; badge = '<span class="badge badge-bronze">Top 3</span>'; }
      tbody.innerHTML += `<tr><td class="${cls}">${rank}</td><td>${row.username} ${badge}</td><td>${row.score.toLocaleString('fr-FR')}</td></tr>`;
    });
  } catch (e) { console.error(e); }
}

async function loadPrizes() {
  try {
    const res = await fetch('/api/prizes');
    const data = await res.json();
    document.getElementById('prizes-list').innerHTML = data.map(p => `
      <div class="prize-row"><div><div class="prize-name">${p.icon} ${p.name}</div><div class="prize-condition">${p.condition}</div></div><div class="prize-value">${p.value}</div></div>
    `).join('');
  } catch (e) { console.error(e); }
}

async function loadAdminCodes() {
  try {
    const res = await fetch('/api/admin/codes');
    const data = await res.json();
    document.getElementById('code-list').innerHTML = data.map(c => `<span class="${c.used ? 'code-used' : ''}">${c.code}</span>`).join('');
  } catch (e) { console.error(e); }
}

async function generateCode() {
  try {
    const res = await fetch('/api/admin/generate-code', {method:'POST'});
    const data = await res.json();
    if (data.code) {
      document.getElementById('new-code-display').textContent = 'Nouveau code : ' + data.code;
      loadAdminCodes();
      showToast('Code généré !', 'success');
    }
  } catch (e) { showToast('Erreur', 'error'); }
}

async function checkSession() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const user = await res.json();
      enterDashboard(user.username, user.is_admin);
    }
  } catch (e) {}
}

checkSession();
