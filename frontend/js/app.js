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
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  el.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function showConfirm({ title, message, showReason = false, confirmText = '確認', danger = false }) {
  state._blockNav = true;
  return new Promise(resolve => {
    const done = (result) => {
      state._blockNav = false;
      overlay.remove();
      resolve(result);
    };
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card">
        <h3>${escHtml(title)}</h3>
        <p>${escHtml(message)}</p>
        ${showReason ? '<textarea id="confirmReason" placeholder="請填寫取消理由..." style="width:100%;min-height:60px;margin-top:10px"></textarea>' : ''}
        <div class="confirm-actions">
          <button class="btn btn-ghost" id="confirmCancel">取消</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">${escHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmCancel').onclick = () => done({ confirmed: false });
    overlay.querySelector('#confirmOk').onclick = () => {
      const reason = showReason ? overlay.querySelector('#confirmReason')?.value?.trim() : undefined;
      done({ confirmed: true, reason });
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done({ confirmed: false }); });
  });
}

function showReview({ nickname }) {
  state._blockNav = true;
  return new Promise(resolve => {
  let rating = 0;
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  function renderStars() {
    return Array.from({ length: 5 }, (_, i) =>
      `<span class="review-star" data-r="${i + 1}" style="font-size:2rem;cursor:pointer;color:${i < rating ? 'var(--accent)' : 'var(--border)'};transition:color 0.15s">★</span>`
    ).join('');
  }

  overlay.innerHTML = `
    <div class="confirm-card" style="text-align:center">
      <h3>評價 ${escHtml(nickname)}</h3>
      <div id="starRow" style="margin:16px 0">${renderStars()}</div>
      <textarea id="reviewComment" placeholder="寫下你的評價..." style="width:100%;min-height:60px"></textarea>
      <div class="confirm-actions" style="margin-top:14px">
        <button class="btn btn-ghost" id="reviewCancel">取消</button>
        <button class="btn btn-primary" id="reviewSubmit" disabled>提交評價</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  function close(result) {
    state._blockNav = false;
    overlay.remove();
    resolve(result);
  }

  overlay.querySelector('#reviewCancel').onclick = () => close(null);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

  overlay.querySelectorAll('.review-star').forEach(s => {
    s.onmouseenter = () => {
      const r = parseInt(s.dataset.r);
      overlay.querySelectorAll('.review-star').forEach((ss, i) => {
        ss.style.color = i < r ? 'var(--accent)' : 'var(--border)';
      });
    };
    s.onclick = () => {
      rating = parseInt(s.dataset.r);
      document.getElementById('reviewSubmit').disabled = false;
      overlay.querySelectorAll('.review-star').forEach((ss, i) => {
        ss.style.color = i < rating ? 'var(--accent)' : 'var(--border)';
      });
    };
  });

  overlay.querySelector('#reviewSubmit').onclick = () => {
    close({ rating, comment: document.getElementById('reviewComment').value.trim() });
  };
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
  if (state._blockNav && state._lastHash && location.hash !== state._lastHash) {
    history.replaceState(null, '', state._lastHash);
    renderNav();
    const card = document.querySelector('.confirm-card');
    if (card) {
      card.classList.add('glow-warn');
      setTimeout(() => card.classList.remove('glow-warn'), 1000);
    }
    return;
  }
  state._lastHash = location.hash;
  cleanupHome();
  const main = document.getElementById('mainContent');
  main.classList.remove('home-content');
  const { handler, params } = matchRoute(location.hash);
  document.body.style.overflow = 'hidden';
  window.scrollTo(0, 0);
  main.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div></div>';
  try {
    await handler(main, params);
  } catch (e) {
    main.innerHTML = `<div class="alert alert-error">${e.detail || e.message || '載入失敗'}</div>`;
  }
  document.body.style.overflow = '';
  renderNav();
  initCustomSelects();
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
      { pattern: /^notice/, nav: 'notifications' },
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
function statusBadge(s) { return `<span class="status-badge status-${s}">${statusLabels[s] || s}</span>`; }

let catLabels = {};
let catOptions = [];

async function loadCategories() {
  if (catOptions.length > 0) return catOptions;
  try {
    const cats = await api('/categories/');
    catLabels = {};
    catOptions = cats;
    cats.forEach(c => { catLabels[c.key] = c.label; });
    return cats;
  } catch { return []; }
}

function categoryOptionsHtml(selectedKey) {
  return catOptions.map(c =>
    `<option value="${c.key}" ${c.key === selectedKey ? 'selected' : ''}>${escHtml(c.label)}</option>`
  ).join('');
}

const modeLabels = { reach_out: '可伸手', swap: '需互換' };
const statusLabels = { available: '可交換', reserved: '已預留', exchanged: '無庫存', pending: '待確認', accepted: '已接受', rejected: '已拒絕', cancelled: '已取消', cancel_requested: '申請取消中', completed: '已完成' };const typeMap = { exchange_request: '交換請求', exchange_accepted: '已接受', exchange_rejected: '已拒絕', exchange_completed: '已完成', cancel_requested: '取消申請', exchange_cancelled: '已取消', cancel_rejected: '取消被拒', new_message: '新訊息', new_review: '新評價', item_deleted: '物品已刪除' };

function itemCard(item, exchangeState) {
  const img = item.images?.length
    ? `<img src="${escHtml(item.images[0])}" alt="" loading="lazy" />`
    : '<div class="no-img">無圖片</div>';
  const statusCls = item.status === 'available' ? 'tag-available' : item.status === 'reserved' ? 'tag-reserved' : 'tag-exchanged';
  const dimmed = !!exchangeState;
  return `
    <a href="#/items/${item.id}" class="item-card card">
      ${dimmed ? `<span class="item-card-ex-badge">${statusLabels[exchangeState] || exchangeState}</span>` : ''}
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

const pageHandlers = new Map();
let pageHandlerId = 0;

function pagination(page, totalPages, onChange) {
  if (totalPages <= 1) return '';
  const id = ++pageHandlerId;
  pageHandlers.set(id, onChange);
  return `
    <div class="pagination" data-ph="${id}">
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
        <option value="exchanged" ${filters.status === 'exchanged' ? 'selected' : ''}>無庫存</option>
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

// ─── Home cleanup ─────────────────────────────────────────────────
function cleanupHome() {
  if (state._countdownInterval) { clearInterval(state._countdownInterval); state._countdownInterval = null; }
  if (state._particleRAF) { cancelAnimationFrame(state._particleRAF); state._particleRAF = null; }
  if (state._parallaxHandler) { window.removeEventListener('scroll', state._parallaxHandler); state._parallaxHandler = null; }
}

// ─── PAGE: Home ──────────────────────────────────────────────────
async function homePage(el) {
  cleanupHome();
  el.classList.add('home-content');

  let items = [];
  try { items = (await api('/items/?page_size=8&sort_by=newest')).items; } catch {}

  el.innerHTML = `
    <section class="hero-concert" id="main-content">
      <canvas id="particleCanvas" aria-hidden="true"></canvas>
      <div class="hero-content">
        <div class="hero-badge anim-fade-up">ZUTOMAYO ASIA TOUR 2026</div>
        <h1 class="anim-fade-up">
          <span class="jp">ずっと真夜中でいいのに。</span>
          <span class="highlight">LIVE IN HONG KONG</span>
        </h1>
        <div class="hero-date anim-fade-up">
          2026 <span class="divider">·</span> 6 <span class="divider">·</span> 6
        </div>
        <div class="hero-venue anim-fade-up">📍 亞洲國際博覽館 Arena · 香港</div>
        <div class="btn-group anim-fade-up">
          <a href="https://kktix.com/" target="_blank" rel="noopener noreferrer" class="btn btn-primary">🎫 立即購票</a>
          <a href="#info" class="btn btn-outline" data-scroll="info">了解更多</a>
          <button class="btn btn-outline" id="shareBtn" aria-label="分享此頁面">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            分享
          </button>
        </div>
      </div>
    </section>

    <div class="page-container">
      <section class="countdown-section anim-fade-up" aria-label="倒數計時">
        <h2 class="section-title">距離<span>ZUTOMAYO</span>香港首演還有</h2>
        <div class="countdown-grid" id="countdown">
          <div class="countdown-item"><div class="num" id="cd-days">--</div><div class="label">日</div></div>
          <div class="countdown-item"><div class="num" id="cd-hours">--</div><div class="label">時</div></div>
          <div class="countdown-item"><div class="num" id="cd-mins">--</div><div class="label">分</div></div>
          <div class="countdown-item"><div class="num" id="cd-secs">--</div><div class="label">秒</div></div>
        </div>
      </section>

      <section class="info-section" id="info" aria-labelledby="heading-concert-info">
        <h2 class="section-title" id="heading-concert-info">演唱會<span>資訊</span></h2>
        <div class="info-grid">
          <div class="info-card card anim-fade-up"><div class="icon">📅</div><h3>日期與時間</h3><p>2026 年 6 月 6 日（星期六）<br>入場 18:00 · 開演 19:00</p></div>
          <div class="info-card card anim-fade-up"><div class="icon">📍</div><h3>場地</h3><p>亞洲國際博覽館 Arena<br>香港赤鱲角航展道1號</p></div>
          <div class="info-card card anim-fade-up"><div class="icon">🎫</div><h3>票價</h3><p>HK$ 1,280 / 980 / 680<br>全場劃位坐席</p></div>
          <div class="info-card card anim-fade-up"><div class="icon">🛒</div><h3>售票平台</h3><p>KKtix<br>2026 年 4 月中旬公開發售</p></div>
          <div class="info-card card anim-fade-up"><div class="icon">🚇</div><h3>交通</h3><p>機場快線直達博覽館站<br>多條巴士路線途經</p></div>
          <div class="info-card card anim-fade-up"><div class="icon">⚠️</div><h3>注意事項</h3><p>6 歲以下恕不招待<br>演出期間請勿錄影及拍照</p></div>
        </div>
      </section>

      <section class="setlist-section" id="songs" aria-labelledby="heading-songs">
        <h2 class="section-title" id="heading-songs">人氣<span>曲目</span></h2>
        <div class="setlist-grid">
          <div class="setlist-item card anim-fade-up"><div class="num">01</div><div class="title">勘ぐれい<small>Kangurei</small></div></div>
          <div class="setlist-item card anim-fade-up"><div class="num">02</div><div class="title">秒針を噛む<small>Byoushin wo Kamu</small></div></div>
          <div class="setlist-item card anim-fade-up"><div class="num">03</div><div class="title">正しくなれない<small>Tadashikunarenai</small></div></div>
          <div class="setlist-item card anim-fade-up"><div class="num">04</div><div class="title">暗く黒く<small>Kuraku Kuroku</small></div></div>
          <div class="setlist-item card anim-fade-up"><div class="num">05</div><div class="title">残機<small>Zanki</small></div></div>
          <div class="setlist-item card anim-fade-up"><div class="num">06</div><div class="title">嘘じゃない<small>Uso Janai</small></div></div>
          <div class="setlist-item card anim-fade-up"><div class="num">07</div><div class="title">綺羅キラー<small>Kira Killer</small></div></div>
          <div class="setlist-item card anim-fade-up"><div class="num">08</div><div class="title">不法侵入<small>Fuhou Shinnyuu</small></div></div>
        </div>
      </section>

      <section class="videos-section anim-fade-up" id="videos" aria-labelledby="heading-videos">
        <h2 class="section-title" id="heading-videos">Music <span>Videos</span></h2>
        <div class="video-grid">
          <div class="video-card">
            <div class="video-thumb" data-video-id="At1J4g5T8zE" aria-label="播放 勘ぐれい MV" role="button" tabindex="0"><div class="play-btn">▶</div></div>
            <h4>勘ぐれい <small>Kangurei</small></h4>
          </div>
          <div class="video-card">
            <div class="video-thumb" data-video-id="Gj9z40K9t2A" aria-label="播放 秒針を噛む MV" role="button" tabindex="0"><div class="play-btn">▶</div></div>
            <h4>秒針を噛む <small>Byoushin wo Kamu</small></h4>
          </div>
          <div class="video-card">
            <div class="video-thumb" data-video-id="O2sT3mC6n2Y" aria-label="播放 残機 MV" role="button" tabindex="0"><div class="play-btn">▶</div></div>
            <h4>残機 <small>Zanki</small></h4>
          </div>
          <div class="video-card">
            <div class="video-thumb" data-video-id="eC6JqP3k4ZQ" aria-label="播放 正しくなれない MV" role="button" tabindex="0"><div class="play-btn">▶</div></div>
            <h4>正しくなれない <small>Tadashikunarenai</small></h4>
          </div>
        </div>
      </section>

      <section class="about-section anim-fade-up" id="about" aria-labelledby="heading-about">
        <h2 class="section-title" id="heading-about">關於<span>ZUTOMAYO</span></h2>
        <p>ずっと真夜中でいいのに。（ZUTOMAYO）是一支於 2018 年出道的日本音樂企劃。以獨特的音樂風格、辨識度極高的低沉女聲，以及充滿電影感的 MV 視覺美學迅速走紅。首支單曲〈秒針を噛む〉在 YouTube 上突破 1 億次播放，隨後推出的多首作品均獲得極高人氣。2026 年，ZUTOMAYO 將再度登陸香港，為樂迷帶來一場無法複製的現場演出體驗。</p>
      </section>

      <section class="faq-section anim-fade-up" id="faq" aria-labelledby="heading-faq">
        <h2 class="section-title" id="heading-faq">常見<span>問題</span></h2>
        <div class="faq-list">
          <details><summary>門票何時公開發售？</summary><p>預計 2026 年 4 月中旬於 KKtix 公開發售，請密切留意官方公佈。</p></details>
          <details><summary>是否有年齡限制？</summary><p>6 歲以下恕不招待。6 歲或以上需持有效門票入場。</p></details>
          <details><summary>場內可以拍照或錄影嗎？</summary><p>演出期間請勿錄影、錄音及拍照，以免影響其他觀眾及演出者。</p></details>
          <details><summary>如何前往亞洲國際博覽館？</summary><p>可乘搭機場快線至博覽館站（約28分鐘由香港站直達），或乘搭多條巴士路線（E11、E21、E22、E32、E41 等）。</p></details>
          <details><summary>是否有官方周邊商品發售？</summary><p>演唱會當日場館將設有官方周邊商品攤位，詳情稍後公佈。</p></details>
        </div>
      </section>

      <div style="text-align:center;padding:0 0 80px">
        <div class="social-links">
          <a href="https://www.youtube.com/@ZUTOMAYO" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29.94 29.94 0 0 0 1 12a29.94 29.94 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29.94 29.94 0 0 0 23 12a29.94 29.94 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>
          </a>
          <a href="https://x.com/zutomayo_staff" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l6.5 7.5L4 20h1.5l5.5-6.5 4.5 6.5H20l-7-8 6.5-7.5h-1.5L12.5 11 8 4H4z"/></svg>
          </a>
          <a href="https://www.instagram.com/zutomayo_off/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
          <a href="https://zutomayo.jp/" target="_blank" rel="noopener noreferrer" aria-label="官方網站">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </a>
        </div>
      </div>

      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2>最新物品</h2>
          <a href="#/items">查看全部 →</a>
        </div>
        ${items.length ? `<div class="grid">${items.map(it => itemCard(it)).join('')}</div>` : '<div class="empty-state"><p>暫無物品，快來成為第一個發佈者</p><a href="#/items/new" class="btn btn-primary">發佈物品</a></div>'}
      </section>
    </div>`;

  initParticles();
  initCountdown();
  initYouTubeLazy();
  initParallaxOrbs();
  initScrollAnimations();
  initShareButton();
  initHomeScrollLinks();
}

// ─── Concert Init Functions ────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const isMobile = window.innerWidth < 768;
  const PARTICLE_COUNT = isMobile ? 30 : 70;
  const pColors = ['rgba(139,92,246,OPACITY)', 'rgba(217,70,239,OPACITY)', 'rgba(34,211,238,OPACITY)'];

  function resizeCanvas() {
    const hero = canvas.closest('.hero-concert');
    canvas.width = hero ? hero.offsetWidth : canvas.offsetWidth;
    canvas.height = hero ? hero.offsetHeight : canvas.offsetHeight;
  }
  window.addEventListener('resize', resizeCanvas);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height + 10;
      this.size = Math.random() * 2.5 + 0.8;
      this.speedY = -(Math.random() * 0.4 + 0.15);
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.5 + 0.15;
      this.color = pColors[Math.floor(Math.random() * 3)];
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.opacity -= 0.0015;
      if (this.y < -10 || this.opacity <= 0) this.reset();
    }
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color.replace('OPACITY', this.opacity.toFixed(2));
      ctx.fill();
    }
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  resizeCanvas();
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = new Particle();
    p.y = Math.random() * canvas.height;
    particles.push(p);
  }

  function animate() {
    if (!document.getElementById('particleCanvas')) { state._particleRAF = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(ctx); });
    state._particleRAF = requestAnimationFrame(animate);
  }
  animate();
}

function initCountdown() {
  const target = new Date('2026-06-06T19:00:00+08:00');
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minsEl = document.getElementById('cd-mins');
  const secsEl = document.getElementById('cd-secs');
  if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

  let prev = { days: -1, hours: -1, mins: -1, secs: -1 };
  function pad(n) { return String(n).padStart(2, '0'); }

  function update() {
    if (!document.getElementById('cd-days')) { clearInterval(state._countdownInterval); state._countdownInterval = null; return; }
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) {
      ['days','hours','mins','secs'].forEach(id => {
        const el = document.getElementById('cd-' + id);
        if (el) el.textContent = '00';
      });
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    const vals = { days, hours: pad(hours), mins: pad(mins), secs: pad(secs) };
    for (const [key, val] of Object.entries(vals)) {
      const el = document.getElementById('cd-' + key);
      if (!el) continue;
      if (String(prev[key]) !== String(val)) {
        el.style.transform = 'scale(1.25)';
        el.style.transition = 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)';
        el.textContent = val;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { el.style.transform = 'scale(1)'; });
        });
      }
      prev[key] = val;
    }
  }
  update();
  state._countdownInterval = setInterval(update, 1000);
}

function initYouTubeLazy() {
  document.querySelectorAll('.video-thumb').forEach(thumb => {
    function loadVideo() {
      const videoId = thumb.dataset.videoId;
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px;';
      iframe.title = thumb.getAttribute('aria-label') || 'YouTube video';
      thumb.style.position = 'relative';
      thumb.style.paddingBottom = '56.25%';
      thumb.appendChild(iframe);
    }
    thumb.addEventListener('click', loadVideo, { once: true });
    thumb.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadVideo(); }
    }, { once: true });
  });
}

function initParallaxOrbs() {
  const orb1 = document.querySelector('.glow-orb-1');
  const orb2 = document.querySelector('.glow-orb-2');
  if (!orb1 || !orb2) return;

  function onScroll() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? window.scrollY / docHeight : 0;
    orb1.style.transform = 'translate(' + (pct * 40) + 'px, ' + (pct * 60) + 'px)';
    orb2.style.transform = 'translate(' + (-pct * 30) + 'px, ' + (-pct * 50) + 'px)';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  state._parallaxHandler = onScroll;
}

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.anim-fade-up').forEach(el => observer.observe(el));
}

function initShareButton() {
  const btn = document.getElementById('shareBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const data = {
      title: 'ZUTOMAYO LIVE IN HONG KONG 2026 | ずっと真夜中でいいのに。',
      text: '2026年6月6日 亞洲國際博覽館 Arena · HK$1,280 / 980 / 680',
      url: window.location.href
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      const orig = btn.innerHTML;
      btn.innerHTML = '&#10003; 已複製連結';
      btn.classList.add('btn-primary');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('btn-primary'); }, 2000);
    }
  });
}

function initHomeScrollLinks() {
  document.querySelectorAll('[data-scroll]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('data-scroll');
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
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
  let exchangeStates = {};

  async function load() {
    const q = new URLSearchParams({ page: filters.page, page_size: 20 });
    q.set('status', filters.status);
    if (filters.search) q.set('search', filters.search);
    if (filters.category) q.set('category', filters.category);
    if (filters.exchange_mode) q.set('exchange_mode', filters.exchange_mode);
    q.set('sort_by', filters.sort_by);
    const [itemsData, exData] = await Promise.all([
      api('/items/?' + q.toString()),
      state.user ? api('/exchanges/?page_size=100') : Promise.resolve({ items: [] }),
    ]);
    data = itemsData;
    exchangeStates = {};
    if (exData.items) {
      exData.items.forEach(ex => {
        if (['pending', 'accepted', 'completed', 'cancel_requested'].includes(ex.status) && ex.to_item_id) {
          exchangeStates[ex.to_item_id] = ex.status;
        }
      });
    }
    render();
  }

  function render() {
    el.innerHTML = `
      <h1>瀏覽物品</h1>
      ${filterBar(filters)}
      ${data.items.length
        ? `<div class="grid">${data.items.map(it => itemCard(it, exchangeStates[it.id])).join('')}</div>${pagination(filters.page, data.total_pages, (p) => { filters.page = p; load(); })}`
        : '<div class="empty-state"><p>暫無物品</p><a href="#/items/new" class="btn btn-primary">成為第一個發佈者</a></div>'}`;
    bindFilterEvents(filters, load);
    initCustomSelects();
  }

  load();
}

function bindFilterEvents(filters, loadFn) {
  const search = document.getElementById('filterSearch');
  const cat = document.getElementById('filterCategory');
  const mode = document.getElementById('filterMode');
  const sort = document.getElementById('filterSort');
  const status = document.getElementById('filterStatus');
  const handler = () => { filters.search = search?.value || ''; filters.category = cat?.value || ''; filters.status = status?.value ?? ''; filters.exchange_mode = mode?.value || ''; filters.sort_by = sort?.value || 'newest'; filters.page = 1; loadFn(); };
  if (search) { let t; search.oninput = () => { clearTimeout(t); t = setTimeout(handler, 300); }; }
  if (cat) cat.onchange = handler;
  if (status) status.onchange = handler;
  if (mode) mode.onchange = handler;
  if (sort) sort.onchange = handler;
}

// ─── PAGE: Item Detail ───────────────────────────────────────────
async function itemDetailPage(el, params) {
  const item = await api('/items/' + params.id);
  const images = item.images || [];
  const hasMulti = images.length > 1;

  const statusCls = item.status === 'available' ? 'tag-available' : item.status === 'reserved' ? 'tag-reserved' : 'tag-exchanged';

  let actions = '';
  if (state.user && item.owner_id !== state.user.id && item.status === 'available') {
    let exStatus = null;
    try { const r = await api('/exchanges/check/' + item.id); exStatus = r.status; } catch {}
    if (exStatus) {
      actions += `<button class="btn btn-primary" disabled style="opacity:0.5;cursor:not-allowed">${exStatus === 'cancel_requested' ? '取消申請中' : '已發起請求'}</button>`;
    } else {
      actions += `<button class="btn btn-primary" id="btnReqExchange">請求交換</button>`;
    }
  }
  if (state.user?.id === item.owner_id) {
    actions += `<a href="#/items/${item.id}/edit" class="btn btn-ghost">編輯</a>`;
    actions += `<button class="btn btn-danger" id="btnDeleteItem">刪除</button>`;
  }
  if (state.user && item.owner_id !== state.user.id) {
    actions += `<button class="btn btn-ghost" id="btnToggleFav">收藏</button>`;
    actions += `<button class="btn btn-ghost" id="btnReport">舉報</button>`;
  }

  el.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-image" id="galleryMain" data-idx="0" style="cursor:${hasMulti ? 'pointer' : 'zoom-in'}">
          ${images.length ? `<img src="${escHtml(images[0])}" alt="" id="galleryImg" />` : '<div class="no-img" style="color:var(--text-muted)">無圖片</div>'}
          ${hasMulti ? `<button class="gallery-arrow prev" id="galPrev">‹</button><button class="gallery-arrow next" id="galNext">›</button>` : ''}
        </div>
        ${hasMulti ? `<div class="detail-thumbs" id="galleryThumbs">${images.map((u, i) => `<img src="${escHtml(u)}" alt="" data-idx="${i}" class="${i === 0 ? 'active' : ''}" />`).join('')}</div>` : ''}
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

  // ── Gallery ────────────────────────────────────────────────────
  if (images.length) {
    const gallery = document.getElementById('galleryMain');
    const img = document.getElementById('galleryImg');

    function setImage(idx) {
      const i = ((idx % images.length) + images.length) % images.length;
      gallery.dataset.idx = i;
      if (img) img.src = images[i];
      const thumbs = document.querySelectorAll('#galleryThumbs img');
      thumbs.forEach(t => t.classList.toggle('active', parseInt(t.dataset.idx) === i));
    }

    // Arrows (detail view)
    if (hasMulti) {
      document.getElementById('galPrev').onclick = (e) => { e.stopPropagation(); setImage(parseInt(gallery.dataset.idx) - 1); };
      document.getElementById('galNext').onclick = (e) => { e.stopPropagation(); setImage(parseInt(gallery.dataset.idx) + 1); };
      // Thumbnails
      document.querySelectorAll('#galleryThumbs img').forEach(t => {
        t.onclick = () => setImage(parseInt(t.dataset.idx));
      });
    }

    // Lightbox
    function openLightbox(startIdx) {
      let lbIdx = startIdx;
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = `
        <button class="lightbox-close">✕</button>
        <button class="gallery-arrow prev">‹</button>
        <img src="${escHtml(images[lbIdx])}" alt="" id="lbImg" />
        <button class="gallery-arrow next">›</button>
        <div class="lightbox-counter">${lbIdx + 1} / ${images.length}</div>`;
      document.body.appendChild(lb);
      document.body.style.overflow = 'hidden';

      function lbSet(i) {
        lbIdx = ((i % images.length) + images.length) % images.length;
        document.getElementById('lbImg').src = images[lbIdx];
        lb.querySelector('.lightbox-counter').textContent = `${lbIdx + 1} / ${images.length}`;
      }

      function close() { lb.remove(); document.body.style.overflow = ''; }
      lb.querySelector('.lightbox-close').onclick = close;
      lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
      lb.querySelector('.gallery-arrow.prev').onclick = (e) => { e.stopPropagation(); lbSet(lbIdx - 1); };
      lb.querySelector('.gallery-arrow.next').onclick = (e) => { e.stopPropagation(); lbSet(lbIdx + 1); };

      // Keyboard
      const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } if (e.key === 'ArrowLeft') lbSet(lbIdx - 1); if (e.key === 'ArrowRight') lbSet(lbIdx + 1); };
      document.addEventListener('keydown', onKey);
      // Touch swipe
      let touchX = 0;
      lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) lbSet(lbIdx + (dx > 0 ? -1 : 1));
      });
    }

    // Click main image → lightbox
    gallery.onclick = (e) => {
      if (e.target.closest('.gallery-arrow')) return;
      openLightbox(parseInt(gallery.dataset.idx));
    };
  }

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
        if (fav.is_favorited) { await api('/favorites/' + item.id, { method: 'DELETE' }); favBtn.textContent = '收藏'; toast('已取消收藏', 'warning'); }
        else { await api('/favorites/', { method: 'POST', body: { item_id: item.id } }); favBtn.textContent = '取消收藏'; toast('已收藏', 'info'); }
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
      initCustomSelects();
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

  // Delete button
  const btnDelete = document.getElementById('btnDeleteItem');
  if (btnDelete) {
    btnDelete.onclick = async () => {
      const res = await showConfirm({ title: '確定要刪除嗎？', message: `「${item.title}」將被永久刪除，且無法恢復。`, confirmText: '確認刪除', danger: true });
      if (!res.confirmed) return;
      try {
        await api('/items/' + item.id, { method: 'DELETE' });
        toast('已刪除', 'warning');
        location.hash = '#/items';
      } catch (e) { toast(e.detail || '刪除失敗', 'error'); }
    };
  }

  // Report button
  const btnReport = document.getElementById('btnReport');
  if (btnReport) {
    btnReport.onclick = async () => {
      const res = await showConfirm({ title: '舉報此物品', message: '如果此物品包含不當內容，請說明原因：', showReason: true, confirmText: '提交舉報', danger: true });
      if (!res.confirmed || !res.reason) return;
      try {
        await api('/reports/', { method: 'POST', body: { target_type: 'item', target_id: item.id, reason: res.reason } });
        toast('已提交舉報', 'info');
      } catch (e) { toast(e.detail || '舉報失敗', 'error'); }
    };
  }
}

// ─── PAGE: Item Create ───────────────────────────────────────────
async function itemCreatePage(el) {
  await loadCategories();
  let images = [];
  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <h1>發佈物品</h1>
      <div id="createError"></div>
      <form id="createForm" class="card" style="padding:24px">
        <div class="form-group"><label>標題 *</label><input type="text" id="itemTitle" required maxlength="200" placeholder="例：ZTMY 2024 巡演限定貼紙" /></div>
        <div class="form-group"><label>描述</label><textarea id="itemDesc" placeholder="物品的詳細描述..."></textarea></div>
        <div class="form-group"><label>類別 *</label><select id="itemCat"><option value="" disabled selected>請選擇類別</option>${categoryOptionsHtml()}</select></div>
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
    const cat = document.getElementById('itemCat').value;
    if (!cat) { errEl.innerHTML = '<div class="alert alert-error">請選擇類別</div>'; return; }
    try {
      const item = await api('/items/', { method: 'POST', body: {
        title: document.getElementById('itemTitle').value,
        description: document.getElementById('itemDesc').value,
        category: cat,
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
  const [, item] = await Promise.all([
    loadCategories(),
    api('/items/' + params.id),
  ]);
  let images = [...(item.images || [])];

  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <h1>編輯物品</h1>
      <div id="editError"></div>
      <form id="editForm" class="card" style="padding:24px">
        <div class="form-group"><label>標題</label><input type="text" id="itemTitle" required maxlength="200" value="${escHtml(item.title)}" /></div>
        <div class="form-group"><label>描述</label><textarea id="itemDesc">${escHtml(item.description || '')}</textarea></div>
        <div class="form-group"><label>類別</label><select id="itemCat">${categoryOptionsHtml(item.category)}</select></div>
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
    const cat = document.getElementById('itemCat').value;
    if (!cat) { errEl.innerHTML = '<div class="alert alert-error">請選擇類別</div>'; return; }
    try {
      await api('/items/' + params.id, { method: 'PUT', body: {
        title: document.getElementById('itemTitle').value,
        description: document.getElementById('itemDesc').value,
        category: cat,
        exchange_mode: document.getElementById('itemMode').value,
        stock: document.getElementById('itemStock').value ? parseInt(document.getElementById('itemStock').value) : null,
        wanted_items: document.getElementById('itemWanted').value,
        images,
      }});
      toast('已更新', 'info');
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
      + (images.length < 5 ? `<label class="upload-zone" id="uploadLabel">+ 上傳<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="uploadInput" /></label>` : '');

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
        toast('上傳成功', 'info');
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
    toast('已刪除', 'warning');
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
        : '<div class="empty-state"><p>暫無交換紀錄</p></div>'}
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
  if (ex.status === 'completed') {
    actions += `<button class="btn btn-primary" id="btnReview">評價</button>`;
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
    try { await api(`/exchanges/${ex.id}/${action}`, { method: 'PUT', body }); toast('操作成功', 'info'); exchangeDetailPage(el, params); } catch (e) { toast(e.detail || '操作失敗', 'error'); }
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
      toast('請提供取消理由', 'warning');
    }
  });
  document.getElementById('btnApproveCancel')?.addEventListener('click', () => act('approve-cancel'));
  document.getElementById('btnRejectCancel')?.addEventListener('click', () => act('reject-cancel'));
  document.getElementById('btnReview')?.addEventListener('click', async () => {
    const targetNickname = isFrom ? ex.to_user_nickname : ex.from_user_nickname;
    const result = await showReview({ nickname: targetNickname });
    if (result) {
      try {
        await api('/reviews/', { method: 'POST', body: { exchange_request_id: ex.id, rating: result.rating, comment: result.comment } });
        toast('評價成功', 'info');
        exchangeDetailPage(el, params);
      } catch (e) { toast(e.detail || '評價失敗', 'error'); }
    }
  });
}

// ─── PAGE: Messages List ─────────────────────────────────────────
async function messagesPage(el) {
  const data = await api('/exchanges/?page_size=100');
  const active = data.items.filter(e => e.id && e.status !== 'completed' && e.status !== 'cancelled');
  el.innerHTML = `
    <div style="margin-bottom:20px"><h1>訊息</h1></div>
    ${active.length
      ? active.map(ex => `
        <a href="#/messages/${ex.id}" class="card" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:var(--text);margin-bottom:10px">
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
  const exchangeId = parseInt(params.exchangeId, 10);
  if (!exchangeId || exchangeId < 1) {
    el.innerHTML = '<div class="alert alert-error">無效的交換請求</div>';
    return;
  }
  const [ex, msgs] = await Promise.all([
    api('/exchanges/' + exchangeId),
    api('/messages/exchanges/' + exchangeId),
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
      const msg = await api('/messages/exchanges/' + exchangeId, { method: 'POST', body: { content: input.value } });
      msgs.push(msg);
      input.value = '';
      render();
    } catch (e) { toast(e.detail || '發送失敗', 'error'); }
  }

  render();

  // Poll for new messages
  const poll = setInterval(async () => {
    try {
      const newMsgs = await api('/messages/exchanges/' + exchangeId);
      if (newMsgs.length !== msgs.length) { msgs.length = 0; msgs.push(...newMsgs); render(); }
    } catch {}
  }, 8000);
  el._poll = poll;
}

// ─── PAGE: Favorites ─────────────────────────────────────────────
async function favoritesPage(el) {
  let page = 1; let data; let exchangeStates = {};
  async function load() {
    const [favData, exData] = await Promise.all([
      api('/favorites/?page=' + page),
      api('/exchanges/?page_size=100'),
    ]);
    data = favData;
    exchangeStates = {};
    exData.items.forEach(ex => {
      if (['pending', 'accepted', 'completed', 'cancel_requested'].includes(ex.status) && ex.to_item_id) {
        exchangeStates[ex.to_item_id] = ex.status;
      }
    });
    render();
  }
  function render() {
    el.innerHTML = `
      <h1>我的收藏</h1>
      ${data.items.length
        ? `<div class="grid">${data.items.map(item => `<div>${itemCard(item, exchangeStates[item.id])}<button class="btn btn-xs btn-danger" data-unfav="${item.id}" style="margin-top:8px">取消收藏</button></div>`).join('')}</div>
           ${pagination(page, data.total_pages, (p) => { page = p; load(); })}`
        : '<div class="empty-state"><p>還沒有收藏任何物品</p><a href="#/items" class="btn btn-primary">瀏覽物品</a></div>'}`;
    el.querySelectorAll('[data-unfav]').forEach(b => b.onclick = async () => {
      await api('/favorites/' + b.dataset.unfav, { method: 'DELETE' });
      toast('已取消收藏', 'warning');
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
        } else if (['new_review','item_deleted'].includes(type)) {
          location.hash = '#/notice/' + nid;
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
        ? `<div class="grid">${items.items.map(it => itemCard(it)).join('')}</div>`
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

// ─── PAGE: Admin Categories ──────────────────────────────────────
async function adminCategoriesPage(el) {
  let cats = [];

  async function load() {
    cats = await api('/admin/categories');
    render();
  }

  function render() {
    el.innerHTML = `
      <h1>類別管理</h1>
      <div class="card" style="margin-bottom:22px;padding:20px">
        <h3 style="margin-bottom:14px">新增類別</h3>
        <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
          <div class="form-group" style="margin:0"><label>Key（英文標識）</label><input type="text" id="catKey" placeholder="例：goods" style="width:130px" /></div>
          <div class="form-group" style="margin:0"><label>Label（顯示名稱）</label><input type="text" id="catLabel" placeholder="例：周邊" style="width:130px" /></div>
          <div class="form-group" style="margin:0"><label>排序</label><input type="number" id="catSort" value="0" style="width:70px" /></div>
          <button class="btn btn-primary btn-sm" id="btnAdd">新增</button>
        </div>
        <div id="addError" style="margin-top:10px"></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Key</th><th>Label</th><th>排序</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            ${cats.map(c => `
              <tr>
                <td><code>${escHtml(c.key)}</code></td>
                <td><input type="text" value="${escHtml(c.label)}" data-edit-label="${c.id}" style="width:100px" /></td>
                <td><input type="number" value="${c.sort_order}" data-edit-sort="${c.id}" style="width:60px" /></td>
                <td>${c.is_active ? '<span style="color:var(--success)">啟用</span>' : '<span style="color:var(--text-muted)">停用</span>'}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-xs btn-ghost" data-save="${c.id}">儲存</button>
                    <button class="btn btn-xs btn-ghost" data-toggle="${c.id}">${c.is_active ? '停用' : '啟用'}</button>
                    <button class="btn btn-xs btn-danger" data-delete="${c.id}">刪除</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById('btnAdd').onclick = async () => {
      const key = document.getElementById('catKey').value.trim();
      const label = document.getElementById('catLabel').value.trim();
      const sort = parseInt(document.getElementById('catSort').value) || 0;
      if (!key || !label) { document.getElementById('addError').innerHTML = '<div class="alert alert-error">請填寫 Key 和 Label</div>'; return; }
      try {
        await api('/admin/categories', { method: 'POST', body: { key, label, sort_order: sort } });
        document.getElementById('addError').innerHTML = '';
        load();
      } catch (e) { document.getElementById('addError').innerHTML = `<div class="alert alert-error">${e.detail || '新增失敗'}</div>`; }
    };

    el.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
      const id = parseInt(b.dataset.save);
      const label = el.querySelector(`[data-edit-label="${id}"]`).value;
      const sort = parseInt(el.querySelector(`[data-edit-sort="${id}"]`).value) || 0;
      try { await api('/admin/categories/' + id, { method: 'PUT', body: { label, sort_order: sort } }); load(); }
      catch (e) { toast(e.detail || '更新失敗', 'error'); }
    });

    el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
      const id = parseInt(b.dataset.toggle);
      const cat = cats.find(c => c.id === id);
      try { await api('/admin/categories/' + id, { method: 'PUT', body: { is_active: !cat.is_active } }); load(); }
      catch (e) { toast(e.detail || '操作失敗', 'error'); }
    });

    el.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
      const id = parseInt(b.dataset.delete);
      if (!confirm('確定要刪除此類別？')) return;
      try { await api('/admin/categories/' + id, { method: 'DELETE' }); load(); }
      catch (e) { toast(e.detail || '刪除失敗', 'error'); }
    });
  }

  await load();
}

// ─── PAGE: Notice Detail ──────────────────────────────────────────
async function noticeDetailPage(el, params) {
  try {
    const n = await api('/notifications/' + params.id);
    const typeMap = { exchange_request: '交換請求', exchange_accepted: '已接受', exchange_rejected: '已拒絕', exchange_completed: '已完成', cancel_requested: '取消申請', exchange_cancelled: '已取消', cancel_rejected: '取消被拒', new_message: '新訊息', new_review: '新評價', item_deleted: '物品已刪除' };
    el.innerHTML = `
      <div class="card" style="max-width:640px;margin:0 auto">
        <h1 style="margin-bottom:16px">通知詳情</h1>
        <div style="margin-bottom:12px">
          <span class="tag">${typeMap[n.type] || n.type}</span>
          <span style="color:var(--text-muted);font-size:0.8rem;margin-left:8px">${formatDateTime(n.created_at)}</span>
        </div>
        <p style="color:var(--text-secondary);line-height:1.7">${escHtml(n.content)}</p>
        ${n.related_id && n.type !== 'item_deleted' ? `<div style="margin-top:16px"><a href="#/exchanges/${n.related_id}" class="btn btn-primary">查看交換詳情</a></div>` : ''}
        <div style="margin-top:16px"><a href="#/notifications" class="btn btn-ghost">← 返回通知列表</a></div>
      </div>`;
    await api('/notifications/' + params.id + '/read', { method: 'PUT' });
  } catch {
    el.innerHTML = '<div class="alert alert-error">通知不存在或無法存取</div>';
  }
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
route('/admin/categories', requireAdmin(adminCategoriesPage));
route('/notice/:id', requireAuth(noticeDetailPage));

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
  if (!btn || btn.disabled) return;
  const wrap = btn.closest('.pagination');
  const handler = pageHandlers.get(parseInt(wrap?.dataset.ph));
  if (handler) handler(parseInt(btn.dataset.page));
});

// ─── Custom Select ─────────────────────────────────────────────────
function closeAllCusels() {
  document.querySelectorAll('.cusel.open').forEach(c => c.classList.remove('open'));
}

function initCustomSelects() {
  document.querySelectorAll('select').forEach(select => {
    if (select.closest('.cusel')) return;

    const options = Array.from(select.options).map(opt => ({
      value: opt.value, label: opt.textContent, selected: opt.selected, disabled: opt.disabled
    }));
    const selected = options.find(o => o.selected) || options.find(o => !o.disabled) || options[0];
    const enabledOptions = options.filter(o => !o.disabled);
    const wrapper = document.createElement('div');
    wrapper.className = 'cusel';

    const trigger = document.createElement('div');
    trigger.className = 'cusel-trigger';
    trigger.innerHTML = `<span class="cusel-label">${selected?.label || ''}</span><span class="cusel-arrow">▸</span>`;

    const drop = document.createElement('div');
    drop.className = 'cusel-drop';
    drop.innerHTML = enabledOptions.map(o =>
      `<div class="cusel-opt${o.selected ? ' sel' : ''}" data-value="${escHtml(o.value)}">${escHtml(o.label)}</div>`
    ).join('');

    wrapper.appendChild(trigger);
    wrapper.appendChild(drop);
    select.style.display = 'none';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    trigger.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const wasOpen = wrapper.classList.contains('open');
      closeAllCusels();
      if (!wasOpen) wrapper.classList.add('open');
    });

    drop.querySelectorAll('.cusel-opt').forEach(optEl => {
      optEl.addEventListener('click', () => {
        trigger.querySelector('.cusel-label').textContent = optEl.textContent;
        drop.querySelectorAll('.cusel-opt').forEach(o => o.classList.remove('sel'));
        optEl.classList.add('sel');
        select.value = optEl.dataset.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        wrapper.classList.remove('open');
      });
    });
  });

  if (!document._cuselListener) {
    document._cuselListener = true;
    document.addEventListener('click', closeAllCusels);
  }
}

// ─── Init ────────────────────────────────────────────────────────
window.addEventListener('hashchange', navigate);
window.addEventListener('load', async () => {
  await checkAuth();
  loadCategories();
  navigate();
  // Poll unread counts
  if (state.user) {
    setInterval(async () => {
      try {
        const [n, m] = await Promise.all([
          api('/notifications/unread-count').catch(() => ({ count: 0 })),
          api('/messages/unread-count').catch(() => ({ count: 0 })),
        ]);
      } catch {}
    }, 30000);
  }
});

// ─── Back to Top ──────────────────────────────────────────────────
const backToTopBtn = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
  if (backToTopBtn) backToTopBtn.classList.toggle('visible', window.scrollY > 600);
}, { passive: true });
if (backToTopBtn) backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
