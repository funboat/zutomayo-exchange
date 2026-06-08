/* ================================================================
   ZUTOMAYO Exchange - Vanilla JS SPA
   ================================================================ */

// ─── State ───────────────────────────────────────────────────────
const state = {
  user: null,
  accessToken: localStorage.getItem('access_token') || '',
  refreshToken: localStorage.getItem('refresh_token') || '',
};

// ─── API Client ──────────────────────────────────────────────────
async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (state.accessToken) headers['Authorization'] = `Bearer ${state.accessToken}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  let res = await fetch('/api' + path, { ...options, headers });
  if (res.status === 401 && !options._retry) {
    try {
      await refreshToken();
      headers['Authorization'] = `Bearer ${state.accessToken}`;
      res = await fetch('/api' + path, { ...options, headers, _retry: true });
    } catch { logout(); return; }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw { status: res.status, ...err };
  }
  return res.json();
}

async function refreshToken() {
  if (!state.refreshToken) throw new Error('No refresh token');
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: state.refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
}

function setTokens(access, refresh) {
  state.accessToken = access;
  state.refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function logout() {
  state.user = null;
  state.accessToken = '';
  state.refreshToken = '';
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  location.hash = '#/login';
}

// ─── Toast ───────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-\${type}`;
  t.textContent = msg;
  el.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function showConfirm({ title, message, showReason = false, confirmText = '確認', danger = false }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card">
        <h3>\${escHtml(title)}</h3>
        <p>\${escHtml(message)}</p>
        \${showReason ? '<textarea id="confirmReason" placeholder="請填寫取消理由..." style="width:100%;min-height:60px;margin-top:10px"></textarea>' : ''}
        <div class="confirm-actions">
          <button class="btn btn-ghost" id="confirmCancel">取消</button>
          <button class="btn \${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">\${escHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmCancel').onclick = () => { overlay.remove(); resolve({ confirmed: false }); };
    overlay.querySelector('#confirmOk').onclick = () => {
      const reason = showReason ? overlay.querySelector('#confirmReason')?.value?.trim() : undefined;
      overlay.remove();
      resolve({ confirmed: true, reason });
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve({ confirmed: false }); } });
  });
}

// ─── Router ──────────────────────────────────────────────────────
const routes = {};

function route(pattern, handler) {
  routes[pattern] = handler;
}

function matchRoute(hash) {
  const path = hash.slice(1) || '/';
  for (const [pattern, handler] of Object.entries(routes)) {
    const keys = [];
    const regex = pattern.replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; });
    const match = path.match(new RegExp(`^${regex}$`));
    if (match) {
      const params = {};
      keys.forEach((k, i) => params[k] = match[i + 1]);
      return { handler, params };
    }
  }
  return { handler: notFoundPage, params: {} };
}

async function navigate() {
  const { handler, params } = matchRoute(location.hash);
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div></div>';
  try {
    await handler(main, params);
  } catch (e) {
    main.innerHTML = `<div class="alert alert-error">${e.detail || e.message || '載入失敗'}</div>`;
  }
  renderNav();
  initCustomSelects();
  window.scrollTo(0, 0);
}

// ─── Navbar ──────────────────────────────────────────────────────
function renderNav() {
  const el = document.getElementById('navLinks');
  const path = location.hash.slice(2) || '/';
  let html = '';
  html += `<a href="#/items" data-nav="items">瀏覽</a>`;
  if (state.user) {
    html += `<a href="#/items/new" data-nav="items/new">發佈</a>`;
    html += `<a href="#/exchanges" data-nav="exchanges">交換</a>`;
    html += `<a href="#/messages" data-nav="messages">訊息${state.unreadMessages > 0 ? `<span class="nav-badge">${state.unreadMessages}</span>` : ''}</a>`;
    html += `<a href="#/notifications" data-nav="notifications">通知${state.unreadNotifications > 0 ? `<span class="nav-badge">${state.unreadNotifications}</span>` : ''}</a>`;
    html += `<a href="#/favorites" data-nav="favorites">收藏</a>`;
    html += `<a href="#/profile/me" data-nav="profile">${escHtml(state.user.nickname)}</a>`;
    if (state.user.is_admin) {
      html += `<span class="admin-menu"><a href="#/admin/invite-codes" data-nav="admin" style="color:var(--accent);cursor:pointer" id="adminMenuToggle">管理 ▾</a><div class="admin-dropdown" id="adminDropdown"><a href="#/admin/invite-codes">邀請碼</a><a href="#/admin/reports">舉報</a><a href="#/admin/categories">類別</a></div></span>`;
    }
    html += `<button onclick="logout()">登出</button>`;
  } else {
    html += `<a href="#/login" data-nav="login">登入</a>`;
    html += `<a href="#/register" data-nav="register">註冊</a>`;
  }
  el.innerHTML = html;

  // Highlight active nav link
  const activeNav = el.querySelector('[data-nav]');
  if (activeNav) {
    const navMap = [
      { pattern: /^items\/new/, nav: 'items/new' },
      { pattern: /^items\/\d+\/edit/, nav: 'items' },
      { pattern: /^items\/\d+/, nav: 'items' },
      { pattern: /^items/, nav: 'items' },
      { pattern: /^exchanges\/\d+/, nav: 'exchanges' },
      { pattern: /^exchanges/, nav: 'exchanges' },
      { pattern: /^messages\/\d+/, nav: 'messages' },
      { pattern: /^messages/, nav: 'messages' },
      { pattern: /^notifications/, nav: 'notifications' },
      { pattern: /^favorites/, nav: 'favorites' },
      { pattern: /^profile/, nav: 'profile' },
      { pattern: /^admin/, nav: 'admin' },
      { pattern: /^login/, nav: 'login' },
      { pattern: /^register/, nav: 'register' },
    ];
    let activeKey = '';
    for (const { pattern, nav } of navMap) {
      if (pattern.test(path)) { activeKey = nav; break; }
    }
    if (activeKey) {
      const link = el.querySelector(`[data-nav="${activeKey}"]`);
      if (link) link.classList.add('active');
    }
  }

  document.getElementById('menuToggle').onclick = () => el.classList.toggle('open');
  document.querySelectorAll('.nav-links a, .nav-links button').forEach(a => {
    a.addEventListener('click', () => el.classList.remove('open'));
  });

  const adminToggle = document.getElementById('adminMenuToggle');
  if (adminToggle) {
    adminToggle.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('adminDropdown').classList.toggle('open');
    };
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.admin-menu')) {
        document.getElementById('adminDropdown').classList.remove('open');
      }
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('zh-HK') : ''; }
function formatDateTime(d) { return d ? new Date(d).toLocaleString('zh-HK') : ''; }
function tag(s, cls) { return `<span class="tag ${cls || ''}">${escHtml(s)}</span>`; }
function statusBadge(s) { return `<span class="status-badge status-${s}">${statusLabels[s]}</span>`; }

let catLabels = {};
let catOptions = [];

async function loadCategories() {
  try {
    const cats = await api('/categories/');
    catLabels = {};
    catOptions = cats;
    cats.forEach(c => { catLabels[c.key] = c.label; });
  } catch { /* keep defaults */ }
}
const modeLabels = { reach_out: '可伸手', swap: '需互換' };
const statusLabels = { available: '可交換', reserved: '已預留', exchanged: '已交換', pending: '待確認', accepted: '已接受', rejected: '已拒絕', cancelled: '已取消', completed: '已完成' };
const typeMap = { exchange_request: '交換請求', exchange_accepted: '已接受', exchange_rejected: '已拒絕', exchange_completed: '已完成', cancel_requested: '取消申請', exchange_cancelled: '已取消', cancel_rejected: '取消被拒', new_message: '新訊息', new_review: '新評價', item_deleted: '物品已刪除' };

function itemCard(item) {
  const img = item.images?.length
    ? `<img src="${escHtml(item.images[0])}" alt="" loading="lazy" />`
    : '<div class="no-img">無圖片</div>';
  const statusCls = item.status === 'available' ? 'tag-available' : item.status === 'reserved' ? 'tag-reserved' : 'tag-exchanged';
  return `
    <a href="#/items/${item.id}" class="item-card card">
      <div class="item-card-img">${img}</div>
      <div class="item-card-body">
        <div class="item-card-title">${escHtml(item.title)}</div>
        <div class="item-card-tags">
          ${tag(catLabels[item.category] || item.category)}
          ${tag(modeLabels[item.exchange_mode] || '需互換', 'tag-mode')}
          ${tag(statusLabels[item.status] || item.status, statusCls)}
        </div>
        ${item.stock === null ? '<div class="stock-info stock-unlimited">無限庫存</div>' : item.stock > 0 ? `<div class="stock-info">剩餘 ${item.stock} 件</div>` : '<div class="stock-info stock-zero">已無庫存</div>'}
        <div class="item-card-owner">${escHtml(item.owner_nickname)}</div>
      </div>
    </a>`;
}

function pagination(page, totalPages, onChange) {
  if (totalPages <= 1) return '';
  return `
    <div class="pagination">
      <button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">上一頁</button>
      <span class="page-info">${page} / ${totalPages}</span>
      <button class="btn btn-sm" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">下一頁</button>
    </div>`;
}

function filterBar(filters) {
  return `
    <div class="filter-bar">
      <input type="text" id="filterSearch" placeholder="搜尋物品..." value="${escHtml(filters.search || '')}" />
      <select id="filterCategory">
        <option value="">全部分類</option>
        <option value="cd" ${filters.category === 'cd' ? 'selected' : ''}>CD</option>
        <option value="goods" ${filters.category === 'goods' ? 'selected' : ''}>周邊</option>
        <option value="poster" ${filters.category === 'poster' ? 'selected' : ''}>海報</option>
        <option value="other" ${filters.category === 'other' ? 'selected' : ''}>其他</option>
      </select>
      <select id="filterStatus">
        <option value="">全部狀態</option>
        <option value="available" ${filters.status === 'available' ? 'selected' : ''}>可交換</option>
        <option value="reserved" ${filters.status === 'reserved' ? 'selected' : ''}>已預留</option>
        <option value="exchanged" ${filters.status === 'exchanged' ? 'selected' : ''}>已交換</option>
      </select>
      <select id="filterMode">
        <option value="">全部模式</option>
        <option value="swap" ${filters.exchange_mode === 'swap' ? 'selected' : ''}>需互換</option>
        <option value="reach_out" ${filters.exchange_mode === 'reach_out' ? 'selected' : ''}>可伸手</option>
      </select>
      <select id="filterSort">
        <option value="newest" ${filters.sort_by === 'newest' ? 'selected' : ''}>最新</option>
        <option value="oldest" ${filters.sort_by === 'oldest' ? 'selected' : ''}>最舊</option>
      </select>
    </div>`;
}

function loadingSpinner() { return '<div class="loading-state"><div class="loading-spinner"></div></div>'; }

// ─── Auth Check ──────────────────────────────────────────────────
async function checkAuth() {
  if (!state.accessToken) return;
  try {
    state.user = await api('/auth/me');
  } catch {
    state.accessToken = '';
    state.refreshToken = '';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

// ─── PAGE: Home ──────────────────────────────────────────────────
async function homePage(el) {
  let items = [];
  try { items = (await api('/items/?page_size=8&sort_by=newest')).items; } catch {}
  el.innerHTML = `
    <div class="hero">
      <h1>ZUTOMAYO <span>無料交換</span></h1>
      <p>在深夜中，與其他粉絲交換心愛的收藏。<br>ずっと真夜中でいいのに。</p>
      <div class="hero-actions">
        <a href="#/items" class="btn btn-primary">瀏覽物品</a>
        <a href="#/items/new" class="btn btn-secondary">發佈物品</a>
      </div>
    </div>
    <section>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2>最新物品</h2>
        <a href="#/items">查看全部 →</a>
      </div>
      ${items.length ? `<div class="grid">${items.map(itemCard).join('')}</div>` : '<div class="empty-state"><p>暫無物品，快來成為第一個發佈者</p><a href="#/items/new" class="btn btn-primary">發佈物品</a></div>'}
    </section>`;
}

// ─── PAGE: Login ─────────────────────────────────────────────────
async function loginPage(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="card auth-card">
        <h1>登入</h1>
        <div id="loginError"></div>
        <form id="loginForm">
          <div class="form-group"><label>電郵</label><input type="email" id="loginEmail" required /></div>
          <div class="form-group"><label>密碼</label><input type="password" id="loginPw" required minlength="8" /></div>
          <button type="submit" class="btn btn-primary" style="width:100%">登入</button>
        </form>
      </div>
      <div class="auth-footer">還沒有帳號？<a href="#/register">註冊</a></div>
    </div>`;

  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    try {
      const data = await api('/auth/login', { method: 'POST', body: {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPw').value,
      }});
      setTokens(data.access_token, data.refresh_token);
      state.user = data.user;
      state.refreshUnread?.();
      toast('登入成功');
      location.hash = '#/';
    } catch (e) { errEl.innerHTML = `<div class="alert alert-error">${e.detail || '登入失敗'}</div>`; }
  };
}

// ─── PAGE: Register ──────────────────────────────────────────────
async function registerPage(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="card auth-card">
        <h1>註冊</h1>
        <div id="regError"></div>
        <form id="regForm">
          <div class="form-group"><label>電郵</label><input type="email" id="regEmail" required /></div>
          <div class="form-group"><label>暱稱</label><input type="text" id="regNick" required minlength="2" maxlength="50" /></div>
          <div class="form-group"><label>密碼（至少 8 字元）</label><input type="password" id="regPw" required minlength="8" /></div>
          <div class="form-group"><label>邀請碼</label><input type="text" id="regCode" required placeholder="請輸入邀請碼" /></div>
          <button type="submit" class="btn btn-primary" style="width:100%">註冊</button>
        </form>
      </div>
      <div class="auth-footer">已有帳號？<a href="#/login">登入</a></div>
    </div>`;

  document.getElementById('regForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('regError');
    try {
      const data = await api('/auth/register', { method: 'POST', body: {
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPw').value,
        nickname: document.getElementById('regNick').value,
        invite_code: document.getElementById('regCode').value,
      }});
      setTokens(data.access_token, data.refresh_token);
      state.user = data.user;
      state.refreshUnread?.();
      toast('註冊成功');
      location.hash = '#/';
    } catch (e) { errEl.innerHTML = `<div class="alert alert-error">${e.detail || '註冊失敗'}</div>`; }
  };
}

// ─── PAGE: Items Browse ──────────────────────────────────────────
async function itemsBrowsePage(el, params) {
  let filters = { search: '', category: '', status: 'available', exchange_mode: '', sort_by: 'newest', page: 1 };
  let data = { items: [], total: 0, total_pages: 1 };

  async function load() {
    const q = new URLSearchParams({ page: filters.page, page_size: 20 });
    if (filters.status) q.set('status', filters.status);
    if (filters.search) q.set('search', filters.search);
    if (filters.category) q.set('category', filters.category);
    if (filters.exchange_mode) q.set('exchange_mode', filters.exchange_mode);
    q.set('sort_by', filters.sort_by);
    data = await api('/items/?' + q.toString());
    render();
  }

  function render() {
    el.innerHTML = `
      <h1>瀏覽物品</h1>
      ${filterBar(filters)}
      ${data.items.length
        ? `<div class="grid">${data.items.map(itemCard).join('')}</div>${pagination(filters.page, data.total_pages, (p) => { filters.page = p; load(); })}`
        : '<div class="empty-state"><p>暫無物品</p><a href="#/items/new" class="btn btn-primary">成為第一個發佈者</a></div>'}`;
    bindFilterEvents(filters, load);
  }

  render();
}

function bindFilterEvents(filters, loadFn) {
  const search = document.getElementById('filterSearch');
  const cat = document.getElementById('filterCategory');
  const mode = document.getElementById('filterMode');
  const sort = document.getElementById('filterSort');
  const status = document.getElementById('filterStatus');
  const handler = () => { filters.search = search?.value || ''; filters.category = cat?.value || ''; filters.status = status?.value || 'available'; filters.exchange_mode = mode?.value || ''; filters.sort_by = sort?.value || 'newest'; filters.page = 1; loadFn(); };
  if (search) { let t; search.oninput = () => { clearTimeout(t); t = setTimeout(handler, 300); }; }
  if (cat) cat.onchange = handler;
  if (status) status.onchange = handler;
  if (mode) mode.onchange = handler;
  if (sort) sort.onchange = handler;
}

// ─── PAGE: Item Detail ───────────────────────────────────────────
async function itemDetailPage(el, params) {
  const item = await api('/items/' + params.id);
  const mainImg = item.images?.length ? `<img src="${escHtml(item.images[0])}" alt="" />` : '<div class="no-img" style="color:var(--text-muted)">無圖片</div>';
  const thumbs = (item.images?.length > 1) ? item.images.map((u, i) => `<img src="${escHtml(u)}" alt="" onclick="this.closest('.detail-grid').querySelector('.detail-image img').src='${escHtml(u)}'" />`).join('') : '';
  const statusCls = item.status === 'available' ? 'tag-available' : item.status === 'reserved' ? 'tag-reserved' : 'tag-exchanged';

  let actions = '';
  if (state.user && item.owner_id !== state.user.id && item.status === 'available') {
    actions += `<button class="btn btn-primary" id="btnReqExchange">請求交換</button>`;
  }
  if (state.user?.id === item.owner_id) {
    actions += `<a href="#/items/${item.id}/edit" class="btn btn-ghost">編輯</a>`;
  }
  if (state.user && item.owner_id !== state.user.id) {
    actions += `<button class="btn btn-ghost" id="btnToggleFav">收藏</button>`;
  }

  el.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-image">${mainImg}</div>
        ${thumbs ? `<div class="detail-thumbs">${thumbs}</div>` : ''}
      </div>
      <div>
        <h1>${escHtml(item.title)}</h1>
        <div class="detail-tags">
          ${tag(catLabels[item.category] || item.category)}
          ${tag(modeLabels[item.exchange_mode] || '需互換', 'tag-mode')}
          ${tag(statusLabels[item.status] || item.status, statusCls)}
        </div>
        ${item.description ? `<div class="detail-desc">${escHtml(item.description)}</div>` : ''}
        ${item.wanted_items ? `<div class="detail-wanted"><strong style="color:var(--accent)">想交換：</strong>${escHtml(item.wanted_items)}</div>` : ''}
        <div class="detail-owner">
          <div class="avatar-circle" style="width:40px;height:40px;font-size:1.1rem">${escHtml((item.owner_nickname || '?')[0])}</div>
          <div>
            <a href="#/profile/${item.owner_id}" style="font-weight:600">${escHtml(item.owner_nickname)}</a>
            <div style="font-size:0.8rem;color:var(--text-muted)">${formatDate(item.created_at)}</div>
          </div>
        </div>
        <div class="detail-actions">${actions}</div>
        <div id="exchangeForm" style="display:none;margin-top:14px;"></div>
      </div>
    </div>`;

  // Fav button
  if (state.user && item.owner_id !== state.user.id) {
    const favBtn = document.getElementById('btnToggleFav');
    try {
      const fav = await api('/favorites/check/' + item.id);
      favBtn.textContent = fav.is_favorited ? '取消收藏' : '收藏';
    } catch {}
    favBtn.onclick = async () => {
      try {
        const fav = await api('/favorites/check/' + item.id);
        if (fav.is_favorited) { await api('/favorites/' + item.id, { method: 'DELETE' }); favBtn.textContent = '收藏'; toast('已取消收藏'); }
        else { await api('/favorites/', { method: 'POST', body: { item_id: item.id } }); favBtn.textContent = '取消收藏'; toast('已收藏'); }
      } catch (e) { toast(e.detail || '操作失敗', 'error'); }
    };
  }

  // Exchange request
  const btnReq = document.getElementById('btnReqExchange');
  if (btnReq) {
    btnReq.onclick = async () => {
      const form = document.getElementById('exchangeForm');
      form.style.display = 'block';

      let myItemsHtml = '';
      if (item.exchange_mode === 'swap') {
        // Fetch user's own available items for swap mode
        let myItems = [];
        try {
          const res = await api('/items/?owner_id=' + state.user.id + '&status=available&page_size=50');
          myItems = res.items.filter(i => i.id !== item.id);
        } catch {}

        if (myItems.length === 0) {
          form.innerHTML = `
            <div class="card">
              <h3 style="margin-bottom:12px;color:var(--warning)">你需要有可交換的物品才能發起互換</h3>
              <p style="color:var(--text-secondary);margin-bottom:12px">請先發佈一件自己的物品，再來發起互換請求。</p>
              <a href="#/items/new" class="btn btn-primary">發佈物品</a>
              <button class="btn btn-ghost" id="btnCancelExchange" style="margin-left:8px">取消</button>
            </div>`;
          document.getElementById('btnCancelExchange').onclick = () => { form.style.display = 'none'; };
          return;
        }

        myItemsHtml = `
          <div class="form-group">
            <label>選擇你要提供的物品 *</label>
            <select id="exchangeFromItem">
              ${myItems.map(i => `<option value="${i.id}">${escHtml(i.title)}</option>`).join('')}
            </select>
          </div>`;
      }

      form.innerHTML = `
        <div class="card">
          <h3 style="margin-bottom:12px">${item.exchange_mode === 'reach_out' ? '伸手索要' : '發起互換請求'}</h3>
          ${myItemsHtml}
          <textarea id="exchangeMsg" placeholder="寫一段話給對方..." style="margin-bottom:12px"></textarea>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" id="btnSendExchange">發送請求</button>
            <button class="btn btn-ghost" id="btnCancelExchange">取消</button>
          </div>
        </div>`;
      document.getElementById('btnCancelExchange').onclick = () => { form.style.display = 'none'; };
      document.getElementById('btnSendExchange').onclick = async () => {
        const msg = document.getElementById('exchangeMsg').value;
        const body = { to_item_id: item.id, message: msg };
        if (item.exchange_mode === 'swap') {
          body.from_item_id = parseInt(document.getElementById('exchangeFromItem').value);
        }
        try {
          await api('/exchanges/', { method: 'POST', body });
          form.style.display = 'none';
          toast('請求已發送！');
        } catch (e) { toast(e.detail || '發送失敗', 'error'); }
      };
    };
  }
}

// ─── PAGE: Item Create ───────────────────────────────────────────
async function itemCreatePage(el) {
  let images = [];
  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <h1>發佈物品</h1>
      <div id="createError"></div>
      <form id="createForm" class="card" style="padding:24px">
        <div class="form-group"><label>標題 *</label><input type="text" id="itemTitle" required maxlength="200" placeholder="例：ZTMY 2024 巡演限定貼紙" /></div>
        <div class="form-group"><label>描述</label><textarea id="itemDesc" placeholder="物品的詳細描述..."></textarea></div>
        <div class="form-group"><label>類別 *</label><select id="itemCat"><option value="cd">CD</option><option value="goods">周邊</option><option value="poster">海報</option><option value="other">其他</option></select></div>
        <div class="form-group"><label>交換方式 *</label><select id="itemMode"><option value="swap">互換（需提供自己的物品）</option><option value="reach_out">伸手（可直接索要）</option></select></div>
        <div class="form-group"><label>庫存（留空為無限）</label><input type="number" id="itemStock" min="1" placeholder="留空表示無限供應" /></div>
        <div class="form-group"><label>想交換什麼</label><textarea id="itemWanted" placeholder="描述你希望換到什麼..."></textarea></div>
        <div class="form-group"><label>圖片</label><div class="image-uploader" id="imageUploader"></div><p class="form-hint">最多 5 張，每張最大 5MB，支援 JPG/PNG/WebP/GIF</p></div>
        <div style="display:flex;gap:10px">
          <button type="submit" class="btn btn-primary">發佈物品</button>
          <a href="#/items" class="btn btn-ghost">取消</a>
        </div>
      </form>
    </div>`;

  renderImageUploader(images);
  document.getElementById('createForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('createError');
    try {
      const item = await api('/items/', { method: 'POST', body: {
        title: document.getElementById('itemTitle').value,
        description: document.getElementById('itemDesc').value,
        category: document.getElementById('itemCat').value,
        exchange_mode: document.getElementById('itemMode').value,
        stock: document.getElementById('itemStock').value ? parseInt(document.getElementById('itemStock').value) : null,
        wanted_items: document.getElementById('itemWanted').value,
        images,
      }});
      toast('發佈成功');
      location.hash = '#/items/' + item.id;
    } catch (e) { errEl.innerHTML = `<div class="alert alert-error">${e.detail || '發佈失敗'}</div>`; }
  };
}

// ─── PAGE: Item Edit ─────────────────────────────────────────────
async function itemEditPage(el, params) {
  const item = await api('/items/' + params.id);
  let images = [...(item.images || [])];

  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <h1>編輯物品</h1>
      <div id="editError"></div>
      <form id="editForm" class="card" style="padding:24px">
        <div class="form-group"><label>標題</label><input type="text" id="itemTitle" required maxlength="200" value="${escHtml(item.title)}" /></div>
        <div class="form-group"><label>描述</label><textarea id="itemDesc">${escHtml(item.description || '')}</textarea></div>
        <div class="form-group"><label>類別</label><select id="itemCat">${['cd','goods','poster','other'].map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${catLabels[c]}</option>`).join('')}</select></div>
        <div class="form-group"><label>交換方式</label><select id="itemMode">
          <option value="swap" ${item.exchange_mode === 'swap' ? 'selected' : ''}>互換（需提供自己的物品）</option>
          <option value="reach_out" ${item.exchange_mode === 'reach_out' ? 'selected' : ''}>伸手（可直接索要）</option>
        </select></div>
        <div class="form-group"><label>庫存（留空為無限）</label><input type="number" id="itemStock" min="1" placeholder="留空表示無限供應" value="${item.stock !== null ? item.stock : ''}" /></div>
        <div class="form-group"><label>想交換什麼</label><textarea id="itemWanted">${escHtml(item.wanted_items || '')}</textarea></div>
        <div class="form-group"><label>圖片</label><div class="image-uploader" id="imageUploader"></div><p class="form-hint">最多 5 張，每張最大 5MB</p></div>
        <div style="display:flex;gap:10px">
          <button type="submit" class="btn btn-primary">更新物品</button>
          <a href="#/items/${item.id}" class="btn btn-ghost">取消</a>
        </div>
      </form>
    </div>`;

  renderImageUploader(images);
  document.getElementById('editForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('editError');
    try {
      await api('/items/' + params.id, { method: 'PUT', body: {
        title: document.getElementById('itemTitle').value,
        description: document.getElementById('itemDesc').value,
        category: document.getElementById('itemCat').value,
        exchange_mode: document.getElementById('itemMode').value,
        stock: document.getElementById('itemStock').value ? parseInt(document.getElementById('itemStock').value) : null,
        wanted_items: document.getElementById('itemWanted').value,
        images,
      }});
      toast('已更新');
      location.hash = '#/items/' + params.id;
    } catch (e) { errEl.innerHTML = `<div class="alert alert-error">${e.detail || '更新失敗'}</div>`; }
  };
}

// ─── Image Uploader ──────────────────────────────────────────────
function renderImageUploader(images) {
  const el = document.getElementById('imageUploader');
  if (!el) return;
  function render() {
    el.innerHTML = images.map((url, i) => `
      <div class="upload-thumb">
        <img src="${escHtml(url)}" alt="" />
        <button type="button" class="remove-btn" data-idx="${i}">×</button>
      </div>`).join('')
      + (images.length < 5 ? `<label class="upload-zone">+ 上傳<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="uploadInput" /></label>` : '');

    el.querySelectorAll('.remove-btn').forEach(b => b.onclick = () => { images.splice(parseInt(b.dataset.idx), 1); render(); });
    const inp = document.getElementById('uploadInput');
    if (inp) inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await api('/upload/image', { method: 'POST', body: formData });
        images.push(res.url);
        render();
        toast('上傳成功');
      } catch (e) { toast(e.detail || '上傳失敗', 'error'); }
    };
  }
  render();
}

// ─── PAGE: My Items ──────────────────────────────────────────────
async function myItemsPage(el) {
  const data = await api('/items/?owner_id=' + state.user.id + '&status=all&page_size=50');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h1>我的物品</h1>
      <a href="#/items/new" class="btn btn-primary">發佈物品</a>
    </div>
    ${data.items.length
      ? `<div class="grid">${data.items.map(item => `
        <div>
          ${itemCard(item)}
          <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
            <a href="#/items/${item.id}/edit" class="btn btn-xs btn-ghost">編輯</a>
            <button class="btn btn-xs btn-danger" data-delete="${item.id}">刪除</button>
          </div>
        </div>`).join('')}</div>`
      : '<div class="empty-state"><p>還沒有發佈任何物品</p><a href="#/items/new" class="btn btn-primary">發佈第一件物品</a></div>'}`;

  el.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
    if (!confirm('確定要刪除此物品？')) return;
    await api('/items/' + b.dataset.delete, { method: 'DELETE' });
    toast('已刪除');
    myItemsPage(el);
  });
}

// ─── PAGE: My Exchanges ──────────────────────────────────────────
async function myExchangesPage(el) {
  let role = '';
  let page = 1;
  let data;

  async function load() {
    const q = new URLSearchParams({ page, page_size: 20 });
    if (role) q.set('role', role);
    data = await api('/exchanges/?' + q.toString());
    render();
  }

  function render() {
    el.innerHTML = `
      <h1>我的交換</h1>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn btn-sm ${!role ? 'btn-primary' : 'btn-ghost'}" data-role="">全部</button>
        <button class="btn btn-sm ${role === 'sent' ? 'btn-primary' : 'btn-ghost'}" data-role="sent">已發送</button>
        <button class="btn btn-sm ${role === 'received' ? 'btn-primary' : 'btn-ghost'}" data-role="received">已收到</button>
      </div>
      ${data.items.length
        ? data.items.map(ex => `
          <a href="#/exchanges/${ex.id}" class="card" style="display:block;text-decoration:none;color:var(--text);margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              ${statusBadge(ex.status)}
              <span style="font-size:0.8rem;color:var(--text-muted)">${formatDate(ex.created_at)}</span>
            </div>
            <div>
              <span style="color:var(--text-secondary);font-size:0.85rem">${ex.from_user_id === state.user.id ? '你' : escHtml(ex.from_user_nickname)} ${ex.to_item_exchange_mode === 'reach_out' ? '伸手索要' : '想要'}</span>
              <strong> ${escHtml(ex.to_item_title)}</strong>
              ${ex.from_item_title ? ` <span style="color:var(--text-muted)">↔ 提供 ${escHtml(ex.from_item_title)}</span>` : ''}
            </div>
          </a>`).join('')
        : '<div class="empty-state"><p>暫無交換記錄</p></div>'}
      ${pagination(page, data.total_pages, (p) => { page = p; load(); })}`;

    el.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { role = b.dataset.role; page = 1; load(); });
  }

  await load();
}

// ─── PAGE: Exchange Detail ───────────────────────────────────────
async function exchangeDetailPage(el, params) {
  const ex = await api('/exchanges/' + params.id);

  let actions = '';
  const isFrom = ex.from_user_id === state.user?.id;
  const isTo = ex.to_user_id === state.user?.id;

  if (isTo && ex.status === 'pending') {
    actions += `<button class="btn btn-primary" id="btnAccept">接受</button>`;
    actions += `<button class="btn btn-danger" id="btnReject">拒絕</button>`;
  }
  if (isFrom && ex.status === 'pending') {
    actions += `<button class="btn btn-ghost" id="btnCancel">取消請求</button>`;
  }
  if (ex.status === 'accepted') {
    actions += `<button class="btn btn-primary" id="btnComplete">標記完成</button>`;
    actions += `<button class="btn btn-ghost" id="btnRequestCancel">提出取消</button>`;
  }
  if (ex.status === 'cancel_requested') {
    const isRequester = ex.cancel_requested_by === state.user?.id;
    if (!isRequester) {
      actions += `<button class="btn btn-primary" id="btnApproveCancel">同意取消</button>`;
      actions += `<button class="btn btn-danger" id="btnRejectCancel">拒絕取消</button>`;
    }
  }
  actions += `<a href="#/messages/${ex.id}" class="btn btn-ghost">查看訊息</a>`;

  el.innerHTML = `
    <h1>交換詳情</h1>
    <div class="card" style="max-width:640px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        ${statusBadge(ex.status)}
        <span style="font-size:0.85rem;color:var(--text-muted)">${formatDate(ex.created_at)}</span>
      </div>
      <div class="ex-participants">
        <div class="ex-participant">
          <strong>${escHtml(ex.from_user_nickname)}</strong>${isFrom ? '（你）' : ''}
          ${ex.from_item_title
            ? `<p style="margin-top:4px">提供：<a href="#/items/${ex.from_item_id}">${escHtml(ex.from_item_title)}</a></p>
               ${ex.from_item_exchange_mode ? `<span class="tag tag-mode" style="font-size:0.7rem">${modeLabels[ex.from_item_exchange_mode] || ex.from_item_exchange_mode}</span>` : ''}`
            : '<p style="color:var(--accent-secondary);font-size:0.8rem;margin-top:4px">伸手索要</p>'}
        </div>
        <div class="ex-arrow">⇄</div>
        <div class="ex-participant">
          <strong>${escHtml(ex.to_user_nickname)}</strong>${isTo ? '（你）' : ''}
          <p style="margin-top:4px">物品：<a href="#/items/${ex.to_item_id}">${escHtml(ex.to_item_title)}</a></p>
          ${ex.to_item_exchange_mode ? `<span class="tag tag-mode" style="font-size:0.7rem">${modeLabels[ex.to_item_exchange_mode] || ex.to_item_exchange_mode}</span>` : ''}
        </div>
      </div>
      ${ex.status === 'cancel_requested'
        ? `<div style="margin-bottom:16px;padding:12px;border:1px solid var(--accent);border-radius:var(--radius-sm);background:rgba(168,85,247,0.08)">
            <strong style="color:var(--accent)">取消申請</strong>
            <p style="margin:6px 0 0">${escHtml(ex.cancel_requested_by === ex.from_user_id ? ex.from_user_nickname : ex.to_user_nickname)} 提出取消，理由：${escHtml(ex.cancel_reason)}</p>
           </div>`
        : ''}
      ${ex.message ? `<div style="margin-top:14px;padding:12px;background:var(--bg);border-radius:var(--radius-sm)"><strong style="color:var(--text-secondary)">交換訊息：</strong>${escHtml(ex.message)}</div>` : ''}
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">${actions}</div>
    </div>`;

  const act = async (action, body) => {
    try { await api(`/exchanges/${ex.id}/${action}`, { method: 'PUT', body }); toast('操作成功'); exchangeDetailPage(el, params); } catch (e) { toast(e.detail || '操作失敗', 'error'); }
  };
  document.getElementById('btnAccept')?.addEventListener('click', () => act('accept'));
  document.getElementById('btnReject')?.addEventListener('click', () => act('reject'));
  document.getElementById('btnCancel')?.addEventListener('click', () => act('cancel'));
  document.getElementById('btnComplete')?.addEventListener('click', () => act('complete'));
  document.getElementById('btnRequestCancel')?.addEventListener('click', async () => {
    const res = await showConfirm({ title: '提出取消申請', message: '確定要取消這個交換嗎？請說明原因：', showReason: true, confirmText: '提出申請' });
    if (res.confirmed && res.reason) {
      await act('request-cancel', { reason: res.reason });
    } else if (res.confirmed && !res.reason) {
      toast('請提供取消理由', 'error');
    }
  });
  document.getElementById('btnApproveCancel')?.addEventListener('click', () => act('approve-cancel'));
  document.getElementById('btnRejectCancel')?.addEventListener('click', () => act('reject-cancel'));
}

// ─── PAGE: Messages List ─────────────────────────────────────────
async function messagesPage(el) {
  const data = await api('/exchanges/?page_size=100');
  const active = data.items.filter(e => e.status !== 'completed' && e.status !== 'cancelled');
  el.innerHTML = `
    <h1>訊息</h1>
    ${active.length
      ? active.map(ex => `
        <a href="#/messages/${ex.id}" class="card" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:var(--text);margin-bottom:8px">
          <div>
            <strong>${escHtml(ex.to_item_title)}</strong>
            <span style="color:var(--text-secondary);margin-left:8px;font-size:0.85rem">${escHtml(ex.from_user_nickname)} ↔ ${escHtml(ex.to_user_nickname)}</span>
          </div>
          ${statusBadge(ex.status)}
        </a>`).join('')
      : '<div class="empty-state"><p>暫無進行中的交換對話</p></div>'}`;
}

// ─── PAGE: Message Thread ────────────────────────────────────────
async function messageThreadPage(el, params) {
  const [ex, msgs] = await Promise.all([
    api('/exchanges/' + params.id),
    api('/messages/exchanges/' + params.id),
  ]);

  function render() {
    el.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <a href="#/exchanges/${ex.id}">← 返回交換詳情</a>
          <p style="margin-top:8px"><strong>${escHtml(ex.to_item_title)}</strong> <span style="color:var(--text-secondary)">· ${escHtml(ex.from_user_nickname)} ↔ ${escHtml(ex.to_user_nickname)}</span></p>
        </div>
        <div class="chat-messages" id="chatMessages">
          ${msgs.length ? msgs.map(m => `
            <div class="chat-msg ${m.sender_id === state.user?.id ? 'chat-msg-mine' : 'chat-msg-other'}">
              <div class="chat-msg-sender">${escHtml(m.sender_nickname)}</div>
              <div class="chat-msg-bubble">${escHtml(m.content)}</div>
              <div class="chat-msg-time">${formatDateTime(m.created_at)}</div>
            </div>`).join('') : '<div class="empty-state" style="padding:28px"><p>還沒有訊息</p></div>'}
        </div>
        <div class="chat-input-row">
          <input type="text" id="msgInput" placeholder="輸入訊息..." />
          <button class="btn btn-primary" id="btnSend">發送</button>
        </div>
      </div>`;
    const chatEl = document.getElementById('chatMessages');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;

    document.getElementById('btnSend').onclick = sendMsg;
    document.getElementById('msgInput').onkeyup = (e) => { if (e.key === 'Enter') sendMsg(); };
  }

  async function sendMsg() {
    const input = document.getElementById('msgInput');
    if (!input.value.trim()) return;
    try {
      const msg = await api('/messages/exchanges/' + params.id, { method: 'POST', body: { content: input.value } });
      msgs.push(msg);
      input.value = '';
      render();
    } catch (e) { toast(e.detail || '發送失敗', 'error'); }
  }

  render();

  // Poll for new messages
  const poll = setInterval(async () => {
    try {
      const newMsgs = await api('/messages/exchanges/' + params.id);
      if (newMsgs.length !== msgs.length) { msgs.length = 0; msgs.push(...newMsgs); render(); }
    } catch {}
  }, 8000);
  el._poll = poll;
}

// ─── PAGE: Favorites ─────────────────────────────────────────────
async function favoritesPage(el) {
  let page = 1; let data;
  async function load() {
    data = await api('/favorites/?page=' + page);
    render();
  }
  function render() {
    el.innerHTML = `
      <h1>我的收藏</h1>
      ${data.items.length
        ? `<div class="grid">${data.items.map(item => `<div>${itemCard(item)}<button class="btn btn-xs btn-danger" data-unfav="${item.id}" style="margin-top:8px">取消收藏</button></div>`).join('')}</div>
           ${pagination(page, data.total_pages, (p) => { page = p; load(); })}`
        : '<div class="empty-state"><p>還沒有收藏任何物品</p><a href="#/items" class="btn btn-primary">瀏覽物品</a></div>'}`;
    el.querySelectorAll('[data-unfav]').forEach(b => b.onclick = async () => {
      await api('/favorites/' + b.dataset.unfav, { method: 'DELETE' });
      toast('已取消收藏');
      load();
    });
  }
  await load();
}

// ─── PAGE: Notifications ─────────────────────────────────────────
async function notificationsPage(el) {
  let page = 1; let data;
  const typeMap = { exchange_request: '交換請求', exchange_accepted: '已接受', exchange_rejected: '已拒絕', exchange_completed: '已完成', cancel_requested: '取消申請', exchange_cancelled: '已取消', cancel_rejected: '取消被拒', new_message: '新訊息', new_review: '新評價', item_deleted: '物品已刪除' };

  async function load() {
    data = await api('/notifications/?page=' + page);
    render();
  }
  function render() {
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h1>通知</h1>
        <button class="btn btn-sm btn-ghost" id="btnReadAll">全部已讀</button>
      </div>
      ${data.items.length
        ? data.items.map(n => `
          <div class="card notif-item ${n.is_read ? '' : 'notif-unread'}" data-nid="${n.id}" data-related="${n.related_id || ''}" data-type="${n.type}">
            <div class="notif-header">
              <span class="notif-type-tag">${typeMap[n.type] || n.type}</span>
              <span class="notif-time">${formatDateTime(n.created_at)}</span>
            </div>
            <p>${escHtml(n.content)}</p>
          </div>`).join('')
        : '<div class="empty-state"><p>暫無通知</p></div>'}
      ${pagination(page, data.total_pages, (p) => { page = p; load(); })}`;

    document.getElementById('btnReadAll')?.addEventListener('click', async () => {
      await api('/notifications/read-all', { method: 'PUT' });
      load();
    });

    el.querySelectorAll('.notif-item').forEach(item => {
      item.onclick = async () => {
        const nid = parseInt(item.dataset.nid);
        const related = item.dataset.related;
        const type = item.dataset.type;
        await api(`/notifications/${nid}/read`, { method: 'PUT' });
        if (related && ['exchange_request','exchange_accepted','exchange_rejected','exchange_completed','cancel_requested','exchange_cancelled','cancel_rejected'].includes(type)) {
          location.hash = '#/exchanges/' + related;
        } else if (related && type === 'new_message') {
          location.hash = '#/messages/' + related;
        }
      };
    });
  }
  await load();
}

// ─── PAGE: User Profile ──────────────────────────────────────────
async function userProfilePage(el, params) {
  const uid = params.id || 'me';
  const isMe = uid === 'me' || String(state.user?.id) === uid;
  const actualId = isMe ? state.user.id : uid;

  const [profile, items] = await Promise.all([
    api('/users/' + actualId).catch(() => null),
    api('/users/' + actualId + '/items?page_size=50').catch(() => ({ items: [], total_pages: 1 })),
  ]);
  if (!profile) { el.innerHTML = '<div class="alert alert-error">用戶不存在</div>'; return; }

  const reviews = await api('/users/' + actualId + '/reviews?page_size=10').catch(() => ({ items: [] }));

  let tab = 'items';

  function render() {
    el.innerHTML = `
      <div class="card profile-header">
        <div class="profile-info">
          <div class="avatar-circle">${escHtml((profile.nickname || '?')[0])}</div>
          <div>
            <h1 style="margin-bottom:4px">${escHtml(profile.nickname)}</h1>
            <div style="color:var(--text-secondary);font-size:0.9rem">
              物品 ${profile.item_count} · 評價 ${profile.avg_rating ? profile.avg_rating + ' / 5' : '暫無'}
            </div>
            <div style="color:var(--text-muted);font-size:0.8rem;margin-top:4px">加入於 ${formatDate(profile.created_at)}</div>
          </div>
        </div>
      </div>
      <div class="profile-tabs">
        <button class="btn btn-sm ${tab === 'items' ? 'btn-primary' : 'btn-ghost'}" id="tabItems">物品 (${profile.item_count})</button>
        <button class="btn btn-sm ${tab === 'reviews' ? 'btn-primary' : 'btn-ghost'}" id="tabReviews">評價 (${reviews.total || 0})</button>
      </div>
      <div id="profileTabContent"></div>`;

    const content = document.getElementById('profileTabContent');
    if (tab === 'items') {
      content.innerHTML = items.items.length
        ? `<div class="grid">${items.items.map(itemCard).join('')}</div>`
        : '<div class="empty-state"><p>暫無物品</p></div>';
    } else {
      content.innerHTML = reviews.items.length
        ? reviews.items.map(r => `
          <div class="card" style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <strong>${escHtml(r.reviewer_nickname)}</strong>
              <span style="color:var(--warning)">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            </div>
            ${r.comment ? `<p style="color:var(--text-secondary);font-size:0.9rem">${escHtml(r.comment)}</p>` : ''}
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">${formatDate(r.created_at)}</div>
          </div>`).join('')
        : '<div class="empty-state"><p>暫無評價</p></div>';
    }

    document.getElementById('tabItems').onclick = () => { tab = 'items'; render(); };
    document.getElementById('tabReviews').onclick = () => { tab = 'reviews'; render(); };
  }
  render();
}

// ─── PAGE: Admin Invite Codes ────────────────────────────────────
async function adminInvitePage(el) {
  const data = await api('/admin/invite-codes?page_size=50');

  el.innerHTML = `
    <h1>邀請碼管理</h1>
    <div class="card" style="margin-bottom:22px;padding:20px">
      <h3 style="margin-bottom:14px">生成邀請碼</h3>
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
        <div class="form-group" style="margin:0"><label>數量</label><input type="number" id="genCount" value="5" min="1" max="50" style="width:80px" /></div>
        <div class="form-group" style="margin:0"><label>前綴</label><input type="text" id="genPrefix" value="ZTMY" style="width:110px" /></div>
        <button class="btn btn-primary btn-sm" id="btnGen">生成</button>
      </div>
      <div id="genResult" style="margin-top:12px"></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>邀請碼</th><th>狀態</th><th>使用者 ID</th><th>建立時間</th></tr></thead>
        <tbody>
          ${data.items.map(c => `
            <tr>
              <td><code>${escHtml(c.code)}</code></td>
              <td>${c.is_used ? '<span style="color:var(--text-muted)">已使用</span>' : '<span style="color:var(--success)">未使用</span>'}</td>
              <td>${c.used_by || '-'}</td>
              <td>${formatDateTime(c.created_at)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.getElementById('btnGen').onclick = async () => {
    const count = document.getElementById('genCount').value;
    const prefix = document.getElementById('genPrefix').value;
    try {
      const res = await api(`/admin/invite-codes?count=${count}&prefix=${encodeURIComponent(prefix)}`, { method: 'POST' });
      document.getElementById('genResult').innerHTML = `<div class="alert alert-success">已生成 ${res.codes.length} 個：<br>${res.codes.map(c => `<code>${c}</code>`).join('<br>')}</div>`;
      setTimeout(() => adminInvitePage(el), 2000);
    } catch (e) { toast(e.detail || '生成失敗', 'error'); }
  };
}

// ─── PAGE: Admin Reports ─────────────────────────────────────────
async function adminReportsPage(el) {
  let page = 1; let data;
  async function load() {
    data = await api('/reports/?page=' + page);
    render();
  }
  function render() {
    el.innerHTML = `
      <h1>舉報管理</h1>
      ${data.items.length
        ? data.items.map(r => `
          <div class="card" style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span><strong>${escHtml(r.reporter_nickname)}</strong> 舉報了 <strong>${escHtml(r.target_type)} #${r.target_id}</strong></span>
              <span style="color:${r.status === 'pending' ? 'var(--warning)' : 'var(--text-muted)'}">${r.status}</span>
            </div>
            <p style="margin-bottom:12px;color:var(--text-secondary)">${escHtml(r.reason)}</p>
            ${r.status === 'pending' ? `
              <div style="display:flex;gap:8px">
                <button class="btn btn-xs btn-primary" data-resolve="${r.id}">標記已處理</button>
                <button class="btn btn-xs btn-ghost" data-dismiss="${r.id}">駁回</button>
              </div>` : ''}
          </div>`).join('')
        : '<div class="empty-state"><p>暫無舉報</p></div>'}
      ${pagination(page, data.total_pages, (p) => { page = p; load(); })}`;

    el.querySelectorAll('[data-resolve]').forEach(b => b.onclick = async () => { await api('/reports/' + b.dataset.resolve, { method: 'PUT', body: { status: 'resolved' } }); load(); });
    el.querySelectorAll('[data-dismiss]').forEach(b => b.onclick = async () => { await api('/reports/' + b.dataset.dismiss, { method: 'PUT', body: { status: 'dismissed' } }); load(); });
  }
  await load();
}

// ─── PAGE: 404 ───────────────────────────────────────────────────
async function notFoundPage(el) {
  el.innerHTML = `
    <div style="text-align:center;padding:80px 20px">
      <h1 style="font-size:5rem;color:var(--text-muted);font-weight:900">404</h1>
      <p style="font-size:1.15rem;margin-bottom:24px;color:var(--text-secondary)">找不到此頁面</p>
      <a href="#/" class="btn btn-primary">返回首頁</a>
    </div>`;
}

// ─── Route Registration ──────────────────────────────────────────
route('/', homePage);
route('/login', loginPage);
route('/register', registerPage);
route('/items', itemsBrowsePage);
route('/items/new', requireAuth(itemCreatePage));
route('/items/:id', itemDetailPage);
route('/items/:id/edit', requireAuth(itemEditPage));
route('/profile/me', requireAuth(userProfilePage));
route('/profile/:id', userProfilePage);
route('/my-items', requireAuth(myItemsPage));
route('/exchanges', requireAuth(myExchangesPage));
route('/exchanges/:id', requireAuth(exchangeDetailPage));
route('/messages', requireAuth(messagesPage));
route('/messages/:exchangeId', requireAuth(messageThreadPage));
route('/favorites', requireAuth(favoritesPage));
route('/notifications', requireAuth(notificationsPage));
route('/admin/invite-codes', requireAdmin(adminInvitePage));
route('/admin/reports', requireAdmin(adminReportsPage));

// Auth wrappers
function requireAuth(handler) {
  return async (el, params) => {
    if (!state.user) { location.hash = '#/login'; return; }
    await handler(el, params);
  };
}
function requireAdmin(handler) {
  return async (el, params) => {
    if (!state.user) { location.hash = '#/login'; return; }
    if (!state.user.is_admin) { notFoundPage(el); return; }
    await handler(el, params);
  };
}

// Event delegation for pagination
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.pagination button[data-page]');
  if (!btn) return;
  const handler = btn._pageHandler;
  if (handler) handler(parseInt(btn.dataset.page));
});

// ─── Init ────────────────────────────────────────────────────────
window.addEventListener('hashchange', navigate);
window.addEventListener('load', async () => {
  await checkAuth();
  navigate();
  // Poll unread counts
  if (state.user) {
    setInterval(async () => {
      try {
        const [n, m] = await Promise.all([
          api('/notifications/unread-count').catch(() => ({ count: 0 })),
          api('/messages/unread-count').catch(() => ({ count: 0 })),
        ]);
        // Update badge in nav if we add one later
      } catch {}
    }, 30000);
  }
});
