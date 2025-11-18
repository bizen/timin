// ========================================
// Timin - Modern SPA Architecture
// ========================================

// Global state
const state = {
  currentUser: null,
  currentView: 'auth',
  shifts: [],
  applications: [],
  isDarkMode: localStorage.getItem('theme') === 'dark'
};

// ========================================
// Utilities
// ========================================

const fmtAUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

function toLocal(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ja-JP', { 
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit'
    }).format(d);
  } catch (e) { 
    return iso; 
  }
}

async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data.error || 'Unknown error'), { status: res.status, data });
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

function showToast(type, title, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <div style="font-size: 24px;">${icons[type] || 'ℹ️'}</div>
    <div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
      ${message ? `<div style="font-size: 14px; color: var(--text-secondary);">${message}</div>` : ''}
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ========================================
// View System
// ========================================

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`${viewName}View`);
  if (targetView) {
    targetView.classList.add('active');
    state.currentView = viewName;
  }
  updateBottomNav();
}

function updateBottomNav() {
  const bottomNav = document.getElementById('bottomNav');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (!state.currentUser) {
    bottomNav.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    return;
  }
  
  logoutBtn.classList.remove('hidden');
  bottomNav.classList.remove('hidden');
  
  // Generate nav items based on role
  const navItems = state.currentUser.role === 'worker' ? [
    { id: 'workerHome', icon: '🏠', label: 'ホーム' },
    { id: 'workerApplications', icon: '📋', label: '応募履歴' },
    { id: 'workerProfile', icon: '👤', label: 'プロフィール' }
  ] : [
    { id: 'employerDashboard', icon: '📊', label: 'シフト' },
    { id: 'employerPost', icon: '➕', label: '投稿' },
    { id: 'employerProfile', icon: '👤', label: 'プロフィール' }
  ];
  
  bottomNav.innerHTML = navItems.map(item => `
    <a class="nav-item ${state.currentView === item.id ? 'active' : ''}" data-view="${item.id}">
      <span class="icon">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `).join('');
  
  // Add click handlers
  bottomNav.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      showView(view);
      renderCurrentView();
    });
  });
}

// ========================================
// Dark Mode
// ========================================

function initDarkMode() {
  const html = document.documentElement;
  const darkModeToggle = document.getElementById('darkModeToggle');
  const darkModeIcon = document.getElementById('darkModeIcon');
  
  // Apply saved theme
  if (state.isDarkMode) {
    html.classList.add('dark-mode');
  }
  
  // Update icon if element exists
  if (darkModeIcon && state.isDarkMode) {
    darkModeIcon.textContent = '☀️';
  }
  
  // Add event listener only if button exists
  if (darkModeToggle && darkModeIcon) {
    darkModeToggle.addEventListener('click', () => {
      state.isDarkMode = !state.isDarkMode;
      html.classList.toggle('dark-mode');
      darkModeIcon.textContent = state.isDarkMode ? '☀️' : '🌙';
      localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
    });
  }
}

// ========================================
// Auth Functions
// ========================================

async function refreshUser() {
  try {
    const user = await api('/api/me');
    state.currentUser = user;
    
    if (user.role === 'worker' && !user.profile?.englishLevel) {
      showView('setup');
      renderSetupView();
    } else {
      showView(user.role === 'worker' ? 'workerHome' : 'employerDashboard');
      await renderCurrentView();
    }
  } catch (e) {
    state.currentUser = null;
    showView('auth');
    renderAuthView();
  }
}

function renderAuthView() {
  const roleSelect = document.getElementById('authRole');
  const abnField = document.getElementById('abnField');
  
  if (roleSelect && abnField) {
    roleSelect.addEventListener('change', (e) => {
      abnField.classList.toggle('hidden', e.target.value !== 'employer');
    });
  }
}

// ========================================
// Setup View (First time worker setup)
// ========================================

function renderSetupView() {
  const setupView = document.getElementById('setupView');
  setupView.innerHTML = `
    <div class="container" style="padding-top: 40px; max-width: 600px;">
      <div class="text-center mb-4">
        <div style="font-size: 64px; margin-bottom: 16px;">👋</div>
        <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">
          ようこそ、Timinへ！
        </h2>
        <p class="text-muted">
          プロフィールを設定して、お仕事を探し始めましょう
        </p>
      </div>
      
      <div class="card">
        <div class="form-group">
          <label class="form-label">🗣️ 英語レベル / English Level <span style="color: var(--error);">*</span></label>
          <select class="form-input" id="setupEnglishLevel" required>
            <option value="">選択してください...</option>
            <option value="beginner">初級 / Beginner (日常会話が少しできる)</option>
            <option value="intermediate">中級 / Intermediate (日常会話・仕事で使える)</option>
            <option value="advanced">上級 / Advanced (ビジネスレベル)</option>
            <option value="native">ネイティブ / Native or Bilingual</option>
          </select>
          <small class="text-muted mt-1">必須項目です</small>
        </div>
        
        <div class="form-group">
          <label class="form-label">👤 名前 / Name</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <input class="form-input" id="setupFirstName" placeholder="太郎">
            <input class="form-input" id="setupLastName" placeholder="山田">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">📞 電話番号 / Phone</label>
          <input class="form-input" id="setupPhone" type="tel" placeholder="+61 4XX XXX XXX">
        </div>
        
        <div class="form-group">
          <label class="form-label">🎯 スキル / Skills</label>
          <input class="form-input" id="setupSkills" placeholder="例: バリスタ, 接客, レジ">
          <small class="text-muted mt-1">カンマ区切りで入力</small>
        </div>
        
        <div class="form-group">
          <label class="form-label">📝 自己紹介 / Bio</label>
          <textarea class="form-input" id="setupBio" rows="3" placeholder="簡単な自己紹介を入力してください..."></textarea>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="setupCompleteBtn">
          ✨ 完了して始める
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('setupCompleteBtn').addEventListener('click', async () => {
    const englishLevel = document.getElementById('setupEnglishLevel').value;
    
    if (!englishLevel) {
      showToast('error', 'エラー', '英語レベルを選択してください');
      return;
    }
    
    const profileData = {
      englishLevel,
      firstName: document.getElementById('setupFirstName').value.trim(),
      lastName: document.getElementById('setupLastName').value.trim(),
      phoneNumber: document.getElementById('setupPhone').value.trim(),
      bio: document.getElementById('setupBio').value.trim(),
      skills: document.getElementById('setupSkills').value.trim()
        .split(',').map(s => s.trim()).filter(s => s)
    };
    
    try {
      await api('/api/me/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      showToast('success', '設定完了！', 'プロフィールを保存しました');
      await refreshUser();
  } catch (e) {
      showToast('error', 'エラー', 'プロフィールの保存に失敗しました');
    }
  });
}

// ========================================
// Worker Views
// ========================================

async function renderWorkerHomeView() {
  const view = document.getElementById('workerHomeView');
  view.innerHTML = `
    <div class="container" style="padding-top: 20px; max-width: 600px;">
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">
        🚀 募集中のシフト
      </h2>
      <div id="swipeContainer"></div>
    </div>
  `;
  
  try {
    const shifts = await api('/api/shifts');
    state.shifts = shifts;
    renderSwipeCards(shifts.filter(s => !s.hiredWorkerId && !s.applicants.includes(state.currentUser.id)));
  } catch (e) {
    showToast('error', 'エラー', 'シフトの読み込みに失敗しました');
  }
}

let currentCardIndex = 0;
let availableShifts = [];

function renderSwipeCards(shifts) {
  availableShifts = shifts;
  currentCardIndex = 0;
  
  const container = document.getElementById('swipeContainer');
  
    if (shifts.length === 0) { 
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">シフトがありません</div>
        <div class="empty-state-desc">新しいシフトが投稿されるまでお待ちください</div>
      </div>
    `;
      return; 
    }
  
  container.innerHTML = `
    <div style="position: relative; width: 100%; height: 600px; margin-bottom: 20px;">
      <div id="cardStack" style="position: relative; width: 100%; height: 100%;"></div>
    </div>
    <div style="display: flex; justify-content: center; gap: 24px;">
      <button class="btn btn-icon" style="width: 64px; height: 64px; background: white; color: var(--error); border: 3px solid var(--error); font-size: 32px;" id="passBtn">
        ✕
      </button>
      <button class="btn btn-icon" style="width: 64px; height: 64px; background: white; color: var(--success); border: 3px solid var(--success); font-size: 32px;" id="applyBtn">
        ♥
      </button>
    </div>
  `;
  
  renderCard();
  
  document.getElementById('passBtn').addEventListener('click', () => handleSwipe(false));
  document.getElementById('applyBtn').addEventListener('click', () => handleSwipe(true));
}

function renderCard() {
  const cardStack = document.getElementById('cardStack');
  
  if (currentCardIndex >= availableShifts.length) {
    cardStack.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <div class="empty-state-title">すべて確認しました！</div>
        <div class="empty-state-desc">新しいシフトが投稿されたらお知らせします</div>
      </div>
    `;
    return;
  }
  
  const shift = availableShifts[currentCardIndex];
  const rate = fmtAUD.format(shift.hourlyRateCents / 100);
  const startDate = new Date(shift.start);
  const endDate = new Date(shift.end);
  const durationHours = Math.round((endDate - startDate) / (1000 * 60 * 60) * 10) / 10;
      
      const categoryEmoji = {
        hospitality: '☕', retail: '🛍️', warehouse: '📦', events: '🎉',
        office: '💼', cleaning: '🧹', delivery: '🚚', general: '⚡'
      };
  
  cardStack.innerHTML = `
    <div class="card" style="position: absolute; width: 100%; height: 100%; overflow-y: auto;">
      <div class="text-center mb-3">
        <div style="font-size: 48px; margin-bottom: 12px;">${categoryEmoji[shift.category] || '⚡'}</div>
        <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${shift.title}</h3>
        <div style="font-size: 32px; font-weight: 700; color: var(--primary);">
          ${rate}<span style="font-size: 16px; color: var(--text-secondary);">/時</span>
            </div>
        <div style="display: inline-block; padding: 4px 12px; background: var(--primary-light); color: var(--primary); border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 8px;">
          ${shift.category || 'general'}
          </div>
        </div>
        
      ${shift.description ? `
        <div style="padding: 16px; background: var(--bg); border-radius: 12px; margin-bottom: 16px; border-left: 3px solid var(--primary);">
          ${shift.description}
          </div>
      ` : ''}
      
      <div style="display: grid; gap: 12px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">📅</span>
          <span>${toLocal(shift.start)}</span>
          </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">⏱️</span>
          <span>${durationHours}時間</span>
          </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">📍</span>
          <span>${shift.location.suburb}, ${shift.location.state} ${shift.location.postcode}</span>
        </div>
        ${shift.applicants.length > 0 ? `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">👥</span>
            <span>${shift.applicants.length}人が応募中</span>
          </div>
        ` : ''}
        </div>
        
      ${shift.requiredSkills && shift.requiredSkills.length > 0 ? `
        <div style="padding: 12px; background: rgba(59,130,246,0.1); border-radius: 8px; border-left: 3px solid var(--secondary); margin-bottom: 12px;">
          <div style="font-weight: 600; margin-bottom: 6px; color: var(--secondary);">🎯 必要なスキル</div>
          <div>${shift.requiredSkills.join(', ')}</div>
        </div>
      ` : ''}
      
      ${shift.dresscode ? `
        <div style="margin-top: 12px;">
          <span style="color: var(--text-secondary);">👔 服装:</span> ${shift.dresscode}
        </div>
      ` : ''}
      
      ${shift.requirements ? `
        <div style="margin-top: 12px;">
          <span style="color: var(--text-secondary);">📜 要件:</span> ${shift.requirements}
          </div>
      ` : ''}
        </div>
      `;
}

async function handleSwipe(apply) {
  const shift = availableShifts[currentCardIndex];
  
  if (apply) {
    try {
      await api(`/api/shifts/${shift.id}/apply`, { method: 'POST' });
      showToast('success', '応募完了！', 'シフトに応募しました');
  } catch (e) {
      showToast('error', '応募失敗', e.message);
    }
  }
  
  currentCardIndex++;
  renderCard();
}

async function renderWorkerApplicationsView() {
  const view = document.getElementById('workerApplicationsView');
  view.innerHTML = `
    <div class="container" style="padding-top: 20px;">
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">
        📋 応募履歴
      </h2>
      <div id="applicationsList"></div>
    </div>
  `;
  
  try {
    const shifts = await api('/api/shifts');
    const myApplications = shifts.filter(s => 
      s.applicants.includes(state.currentUser.id) || s.hiredWorkerId === state.currentUser.id
    );
    
    const listEl = document.getElementById('applicationsList');
    
    if (myApplications.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">応募履歴がありません</div>
          <div class="empty-state-desc">気になるシフトに応募してみましょう</div>
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = myApplications.map(shift => {
      const isHired = shift.hiredWorkerId === state.currentUser.id;
      const status = isHired ? 
        '<span style="color: var(--success); font-weight: 600;">✓ 採用済み</span>' :
        '<span style="color: var(--warning); font-weight: 600;">⏳ 選考中</span>';
      
      return `
        <div class="card" style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${shift.title}</h3>
              <div style="font-size: 14px; color: var(--text-secondary);">${toLocal(shift.start)}</div>
            </div>
            <div>${status}</div>
          </div>
          <div style="font-size: 20px; font-weight: 700; color: var(--primary);">
            ${fmtAUD.format(shift.hourlyRateCents / 100)}/時
          </div>
          <div style="margin-top: 8px; color: var(--text-secondary);">
            📍 ${shift.location.suburb}, ${shift.location.state}
          </div>
        </div>
      `;
    }).join('');
        } catch (e) {
    showToast('error', 'エラー', '応募履歴の読み込みに失敗しました');
  }
}

async function renderWorkerProfileView() {
  const view = document.getElementById('workerProfileView');
  const profile = state.currentUser.profile || {};
  
  view.innerHTML = `
    <div class="container" style="padding-top: 20px; max-width: 600px;">
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">
        👤 プロフィール
      </h2>
      
      <div class="card">
        <div class="form-group">
          <label class="form-label">📧 メールアドレス</label>
          <input class="form-input" value="${state.currentUser.email}" disabled>
        </div>
        
        <div class="form-group">
          <label class="form-label">🗣️ 英語レベル <span style="color: var(--error);">*</span></label>
          <select class="form-input" id="profileEnglishLevel">
            <option value="">選択してください...</option>
            <option value="beginner" ${profile.englishLevel === 'beginner' ? 'selected' : ''}>初級 / Beginner</option>
            <option value="intermediate" ${profile.englishLevel === 'intermediate' ? 'selected' : ''}>中級 / Intermediate</option>
            <option value="advanced" ${profile.englishLevel === 'advanced' ? 'selected' : ''}>上級 / Advanced</option>
            <option value="native" ${profile.englishLevel === 'native' ? 'selected' : ''}>ネイティブ / Native</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">👤 名前</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <input class="form-input" id="profileFirstName" value="${profile.firstName || ''}" placeholder="太郎">
            <input class="form-input" id="profileLastName" value="${profile.lastName || ''}" placeholder="山田">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">📞 電話番号</label>
          <input class="form-input" id="profilePhone" value="${profile.phoneNumber || ''}" placeholder="+61 4XX XXX XXX">
        </div>
        
        <div class="form-group">
          <label class="form-label">🎯 スキル</label>
          <input class="form-input" id="profileSkills" value="${profile.skills ? profile.skills.join(', ') : ''}" placeholder="バリスタ, 接客, レジ">
        </div>
        
        <div class="form-group">
          <label class="form-label">📝 自己紹介</label>
          <textarea class="form-input" id="profileBio" rows="3">${profile.bio || ''}</textarea>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="saveProfileBtn">
          💾 保存
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const englishLevel = document.getElementById('profileEnglishLevel').value;
    
    if (!englishLevel) {
      showToast('error', 'エラー', '英語レベルを選択してください');
      return;
    }
    
    const profileData = {
      englishLevel,
      firstName: document.getElementById('profileFirstName').value.trim(),
      lastName: document.getElementById('profileLastName').value.trim(),
      phoneNumber: document.getElementById('profilePhone').value.trim(),
      bio: document.getElementById('profileBio').value.trim(),
      skills: document.getElementById('profileSkills').value.trim()
        .split(',').map(s => s.trim()).filter(s => s)
    };
    
    try {
      await api('/api/me/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      showToast('success', '保存完了', 'プロフィールを更新しました');
      await refreshUser();
        } catch (e) {
      showToast('error', 'エラー', 'プロフィールの保存に失敗しました');
    }
  });
}

// ========================================
// Employer Views
// ========================================

async function renderEmployerDashboardView() {
  const view = document.getElementById('employerDashboardView');
  view.innerHTML = `
    <div class="container" style="padding-top: 20px;">
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">
        📊 投稿したシフト
      </h2>
      <div id="shiftsList"></div>
    </div>
  `;
  
  try {
    const shifts = await api('/api/shifts?mine=true');
    const listEl = document.getElementById('shiftsList');
    
    if (shifts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">シフトがありません</div>
          <div class="empty-state-desc">新しいシフトを投稿しましょう</div>
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = shifts.map(shift => `
      <div class="card" style="margin-bottom: 16px;" data-shift-id="${shift.id}">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${shift.title}</h3>
            <div style="font-size: 14px; color: var(--text-secondary);">${toLocal(shift.start)}</div>
          </div>
          <div>
            ${shift.hiredWorkerId ? 
              '<span style="color: var(--success); font-weight: 600;">✓ 採用済み</span>' :
              shift.applicants.length > 0 ?
              `<span style="color: var(--secondary); font-weight: 600;">👥 ${shift.applicants.length}人応募中</span>` :
              '<span style="color: var(--text-muted); font-weight: 600;">募集中</span>'
            }
          </div>
        </div>
        <div style="font-size: 20px; font-weight: 700; color: var(--primary);">
          ${fmtAUD.format(shift.hourlyRateCents / 100)}/時
        </div>
        <div style="margin-top: 8px; color: var(--text-secondary);">
          📍 ${shift.location.suburb}, ${shift.location.state}
        </div>
        ${shift.applicants.length > 0 ? `
          <button class="btn btn-secondary btn-sm mt-2" style="width: 100%;" onclick="showApplicants('${shift.id}')">
            応募者を見る (${shift.applicants.length}人)
          </button>
        ` : ''}
      </div>
    `).join('');
        } catch (e) {
    showToast('error', 'エラー', 'シフトの読み込みに失敗しました');
  }
}

window.showApplicants = async function(shiftId) {
  const shifts = await api('/api/shifts');
  const shift = shifts.find(s => s.id === shiftId);
  
  if (!shift || shift.applicants.length === 0) return;
  
  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;';
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: var(--surface); border-radius: 16px; padding: 24px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;';
  
  const applicantsList = [];
  for (const uid of shift.applicants) {
    try {
      const profile = await api(`/api/profile/${uid}`);
      applicantsList.push({
        uid,
        name: profile.profile?.firstName && profile.profile?.lastName ?
          `${profile.profile.firstName} ${profile.profile.lastName}` : uid.slice(0, 8) + '…',
        englishLevel: profile.profile?.englishLevel,
        skills: profile.profile?.skills || []
      });
          } catch (e) {
      applicantsList.push({ uid, name: uid.slice(0, 8) + '…', englishLevel: null, skills: [] });
    }
  }
  
  const levelLabels = {
    'beginner': '🗣️ 初級 / Beginner',
    'intermediate': '🗣️ 中級 / Intermediate',
    'advanced': '🗣️ 上級 / Advanced',
    'native': '🗣️ ネイティブ / Native'
  };
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="font-size: 20px; font-weight: 700;">応募者リスト (${applicantsList.length}人)</h3>
      <button class="btn btn-icon btn-ghost" onclick="this.closest('[style*=fixed]').remove()">✕</button>
    </div>
    ${applicantsList.map(applicant => `
      <div class="card" style="margin-bottom: 12px;">
        <div style="font-weight: 600; margin-bottom: 8px;">👤 ${applicant.name}</div>
        ${applicant.englishLevel ? `
          <div style="font-size: 14px; color: var(--secondary); margin-bottom: 8px;">
            ${levelLabels[applicant.englishLevel]}
          </div>
        ` : ''}
        ${applicant.skills.length > 0 ? `
          <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px;">
            🎯 ${applicant.skills.join(', ')}
          </div>
        ` : ''}
        ${shift.hiredWorkerId === applicant.uid ? `
          <button class="btn btn-sm" disabled style="width: 100%; opacity: 0.5;">✓ 採用済み</button>
        ` : `
          <button class="btn btn-primary btn-sm" style="width: 100%;" onclick="hireWorker('${shift.id}', '${applicant.uid}')">
            ✅ 採用する
          </button>
        `}
      </div>
    `).join('')}
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
};

window.hireWorker = async function(shiftId, workerId) {
  try {
    await api(`/api/shifts/${shiftId}/hire`, {
      method: 'POST',
      body: JSON.stringify({ workerId })
    });
    showToast('success', '採用完了', 'ワーカーを採用しました');
    document.querySelector('[style*=fixed]').remove();
    renderEmployerDashboardView();
    } catch (e) { 
    showToast('error', 'エラー', '採用に失敗しました');
  }
};

async function renderEmployerPostView() {
  const view = document.getElementById('employerPostView');
  view.innerHTML = `
    <div class="container" style="padding-top: 20px; max-width: 600px;">
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">
        ➕ 新しいシフトを投稿
      </h2>
      
      <div class="card">
        <div class="form-group">
          <label class="form-label">📋 シフトのタイトル</label>
          <input class="form-input" id="shiftTitle" placeholder="例: カフェバリスタ（朝シフト）">
        </div>
        
        <div class="form-group">
          <label class="form-label">📝 詳細説明</label>
          <textarea class="form-input" id="shiftDescription" rows="3" placeholder="仕事内容、必要なスキルなどを記入してください"></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">🏷️ カテゴリー</label>
          <select class="form-input" id="shiftCategory">
            <option value="general">一般</option>
            <option value="hospitality">飲食・ホスピタリティ</option>
            <option value="retail">小売</option>
            <option value="warehouse">倉庫</option>
            <option value="events">イベント</option>
            <option value="office">オフィス</option>
            <option value="cleaning">清掃</option>
            <option value="delivery">配達</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">💰 時給 (AUD)</label>
          <input type="number" class="form-input" id="shiftRate" placeholder="28.50" step="0.01" min="15">
        </div>
        
        <div class="form-group">
          <label class="form-label">📍 場所</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <select class="form-input" id="shiftState">
              <option>NSW</option>
              <option>VIC</option>
              <option>QLD</option>
              <option>SA</option>
              <option>WA</option>
              <option>TAS</option>
              <option>ACT</option>
              <option>NT</option>
            </select>
            <input class="form-input" id="shiftPostcode" placeholder="郵便番号" pattern="[0-9]{4}">
          </div>
          <input class="form-input" id="shiftSuburb" placeholder="suburb名">
        </div>
        
        <div class="form-group">
          <label class="form-label">🕐 日時</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <input type="datetime-local" class="form-input" id="shiftStart">
            <input type="datetime-local" class="form-input" id="shiftEnd">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">🎯 必要なスキル（任意）</label>
          <input class="form-input" id="shiftSkills" placeholder="例: バリスタ, 接客経験">
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="postShiftBtn">
          🚀 シフトを投稿
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('postShiftBtn').addEventListener('click', async () => {
    const title = document.getElementById('shiftTitle').value.trim();
    const description = document.getElementById('shiftDescription').value.trim();
    const category = document.getElementById('shiftCategory').value;
    const hourlyRateAUD = parseFloat(document.getElementById('shiftRate').value);
    const state = document.getElementById('shiftState').value;
    const postcode = document.getElementById('shiftPostcode').value.trim();
    const suburb = document.getElementById('shiftSuburb').value.trim();
    const start = document.getElementById('shiftStart').value;
    const end = document.getElementById('shiftEnd').value;
    const requiredSkills = document.getElementById('shiftSkills').value.trim()
      .split(',').map(s => s.trim()).filter(s => s);
    
    if (!title || !hourlyRateAUD || !suburb || !postcode || !start || !end) {
      showToast('error', 'エラー', '必須項目を入力してください');
      return;
    }
    
    try {
      await api('/api/shifts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category,
          hourlyRateAUD,
          location: { state, postcode, suburb },
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          requiredSkills
        })
      });
      
      showToast('success', '投稿完了', 'シフトを投稿しました');
      showView('employerDashboard');
      renderEmployerDashboardView();
    } catch (e) { 
      showToast('error', 'エラー', 'シフトの投稿に失敗しました');
    }
  });
}

async function renderEmployerProfileView() {
  const view = document.getElementById('employerProfileView');
  const profile = state.currentUser.profile || {};
  
  view.innerHTML = `
    <div class="container" style="padding-top: 20px; max-width: 600px;">
      <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">
        👤 プロフィール
      </h2>
      
      <div class="card">
        <div class="form-group">
          <label class="form-label">📧 メールアドレス</label>
          <input class="form-input" value="${state.currentUser.email}" disabled>
        </div>
        
        <div class="form-group">
          <label class="form-label">🏢 会社名</label>
          <input class="form-input" id="profileCompanyName" value="${profile.companyName || ''}" placeholder="Your Company Pty Ltd">
        </div>
        
        <div class="form-group">
          <label class="form-label">🏭 業種</label>
          <select class="form-input" id="profileBusinessType">
            <option value="">選択してください</option>
            <option value="hospitality" ${profile.businessType === 'hospitality' ? 'selected' : ''}>飲食・ホスピタリティ</option>
            <option value="retail" ${profile.businessType === 'retail' ? 'selected' : ''}>小売</option>
            <option value="warehouse" ${profile.businessType === 'warehouse' ? 'selected' : ''}>倉庫</option>
            <option value="events" ${profile.businessType === 'events' ? 'selected' : ''}>イベント</option>
            <option value="office" ${profile.businessType === 'office' ? 'selected' : ''}>オフィス</option>
            <option value="cleaning" ${profile.businessType === 'cleaning' ? 'selected' : ''}>清掃</option>
            <option value="delivery" ${profile.businessType === 'delivery' ? 'selected' : ''}>配達</option>
            <option value="other" ${profile.businessType === 'other' ? 'selected' : ''}>その他</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">📞 電話番号</label>
          <input class="form-input" id="profilePhone" value="${profile.phoneNumber || ''}" placeholder="+61 X XXXX XXXX">
        </div>
        
        <button class="btn btn-primary" style="width: 100%;" id="saveProfileBtn">
          💾 保存
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const profileData = {
      companyName: document.getElementById('profileCompanyName').value.trim(),
      businessType: document.getElementById('profileBusinessType').value,
      phoneNumber: document.getElementById('profilePhone').value.trim()
    };
    
    try {
      await api('/api/me/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      showToast('success', '保存完了', 'プロフィールを更新しました');
      await refreshUser();
    } catch (e) {
      showToast('error', 'エラー', 'プロフィールの保存に失敗しました');
    }
  });
}

// ========================================
// Render Current View
// ========================================

async function renderCurrentView() {
  const viewMap = {
    auth: renderAuthView,
    setup: renderSetupView,
    workerHome: renderWorkerHomeView,
    workerApplications: renderWorkerApplicationsView,
    workerProfile: renderWorkerProfileView,
    employerDashboard: renderEmployerDashboardView,
    employerPost: renderEmployerPostView,
    employerProfile: renderEmployerProfileView
  };
  
  const renderer = viewMap[state.currentView];
  if (renderer) {
    await renderer();
  }
}

// ========================================
// Initialize App
// ========================================

async function init() {
  try {
    initDarkMode();
    
    // Set up global event delegation for auth buttons
    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('#loginBtn') || e.target.closest('#registerBtn');
      if (!btn) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const isLogin = btn.id === 'loginBtn';
      const email = document.getElementById('authEmail')?.value.trim();
      const password = document.getElementById('authPassword')?.value;
      
      if (!email || !password) {
        showToast('error', 'エラー', 'メールアドレスとパスワードを入力してください');
        return;
      }
      
      if (!isLogin) {
        const role = document.getElementById('authRole')?.value;
        const abn = document.getElementById('authAbn')?.value.trim();
        if (role === 'employer' && !abn) {
          showToast('error', 'エラー', 'ABNを入力してください');
          return;
        }
      }
      
      try {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> ${isLogin ? 'ログイン中' : '登録中'}...`;
        
        if (isLogin) {
          await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
          showToast('success', 'ログイン成功', 'ようこそ！');
        } else {
          const role = document.getElementById('authRole').value;
          const abn = document.getElementById('authAbn').value.trim();
          await api('/api/register', { method: 'POST', body: JSON.stringify({ email, password, role, abn }) });
          showToast('success', '登録成功', 'アカウントを作成しました！');
        }
        
        await refreshUser();
      } catch (err) {
        showToast('error', isLogin ? 'ログイン失敗' : '登録失敗', err.message || '処理に失敗しました');
        btn.disabled = false;
        btn.innerHTML = isLogin ? '🔑 ログイン' : '✨ 登録';
      }
    });
    
    // Logo click handler
    document.getElementById('logoLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.currentUser) {
        showView(state.currentUser.role === 'worker' ? 'workerHome' : 'employerDashboard');
        renderCurrentView();
      }
    });
    
    // Logout handler
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      try {
        await api('/api/logout', { method: 'POST' });
        showToast('success', 'ログアウト', 'またのご利用をお待ちしております');
        state.currentUser = null;
        showView('auth');
        renderAuthView();
      } catch (e) {
        showToast('error', 'エラー', 'ログアウトに失敗しました');
      }
    });
    
    await refreshUser();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
