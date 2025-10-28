const fmtAUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const tz = 'Australia/Sydney';

function toLocal(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(d);
  } catch (e) { return iso; }
}

// Toast notification system
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close">×</button>
  `;
  
  container.appendChild(toast);
  
  const closeBtn = toast.querySelector('.toast-close');
  const removeToast = () => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  };
  
  closeBtn.onclick = removeToast;
  
  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

// Loading overlay
let loadingOverlay = null;
function showLoading() {
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.remove();
    loadingOverlay = null;
  }
}

// Enhanced API function with error handling
async function api(path, options = {}) {
  try {
    const res = await fetch(path, { 
      ...options, 
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, 
      credentials: 'same-origin' 
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data.error || 'Unknown error';
      throw Object.assign(new Error(errorMsg), { status: res.status, data });
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Form validation helpers
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  return password && password.length >= 6;
}

function validateABN(abn) {
  const digits = String(abn || '').replace(/[^0-9]/g, '');
  if (digits.length !== 11) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const first = Number(digits[0]) - 1;
  const rest = digits.slice(1).split('').map(Number);
  const nums = [first, ...rest];
  const total = nums.reduce((sum, d, i) => sum + d * weights[i], 0);
  return total % 89 === 0;
}

function setButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = '<span class="spinner"></span>' + button.dataset.originalText;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.textContent;
  }
}

async function refreshMe() {
  const meCard = document.getElementById('meCard');
  const authCard = document.getElementById('authCard');
  const createShiftCard = document.getElementById('createShiftCard');
  const profileCard = document.getElementById('profileCard');
  const authArea = document.getElementById('authArea');
  try {
    const me = await api('/api/me');
    authCard.style.display = 'none';
    meCard.style.display = 'block';
    profileCard.style.display = 'block';
    
    const profileName = me.profile?.firstName && me.profile?.lastName 
      ? `${me.profile.firstName} ${me.profile.lastName}` 
      : me.email;
    
    meCard.innerHTML = `<div class="flex" style="justify-content: center; gap: 12px; flex-wrap: wrap;">
      <div><strong>${profileName}</strong> <span class="badge badge-${me.role === 'employer' ? 'info' : 'success'}">${me.role}</span></div>
      <button id="logoutBtn" class="secondary">🚪 Sign out</button>
    </div>`;
    createShiftCard.style.display = me.role === 'employer' ? 'block' : 'none';
    authArea.innerHTML = `<span style="font-size: 13px;">${profileName}</span>`;
    document.getElementById('logoutBtn').onclick = async () => { 
      showLoading();
      try {
        await api('/api/logout', { method: 'POST' }); 
        showToast('success', 'Logged out', 'See you soon!');
        setTimeout(() => location.reload(), 500);
      } catch (e) {
        hideLoading();
        showToast('error', 'Error', 'Failed to logout');
      }
    };
    
    // Load profile data
    await loadProfile(me);
  } catch (e) {
    authCard.style.display = 'block';
    meCard.style.display = 'none';
    createShiftCard.style.display = 'none';
    profileCard.style.display = 'none';
    authArea.innerHTML = '';
  }
}

async function loadProfile(me) {
  const profile = me.profile || {};
  document.getElementById('profileFirstName').value = profile.firstName || '';
  document.getElementById('profileLastName').value = profile.lastName || '';
  document.getElementById('profilePhone').value = profile.phoneNumber || '';
  document.getElementById('profileBio').value = profile.bio || '';
  
  if (me.role === 'worker') {
    document.getElementById('workerFields').style.display = 'block';
    document.getElementById('employerFields').style.display = 'none';
    document.getElementById('profileSkills').value = profile.skills ? profile.skills.join(', ') : '';
  } else if (me.role === 'employer') {
    document.getElementById('workerFields').style.display = 'none';
    document.getElementById('employerFields').style.display = 'block';
    document.getElementById('profileCompanyName').value = profile.companyName || '';
    document.getElementById('profileBusinessType').value = profile.businessType || '';
  }
}

async function refreshShifts() {
  const mine = document.getElementById('mineOnly').checked;
  const params = mine ? '?mine=true' : '';
  const listEl = document.getElementById('shiftList');
  listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">⏳ Loading shifts...</div>';
  try {
    const shifts = await api('/api/shifts' + params);
    if (!Array.isArray(shifts)) throw new Error('bad list');
    if (shifts.length === 0) { 
      listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);"><div style="font-size: 48px; margin-bottom: 16px;">📭</div><div>No shifts available</div></div>'; 
      return; 
    }
    listEl.innerHTML = '';
    for (const s of shifts) {
      const card = document.createElement('div');
      card.className = 'shift-card';
      
      const rate = fmtAUD.format(s.hourlyRateCents / 100);
      const startDate = new Date(s.start);
      const endDate = new Date(s.end);
      const durationHours = Math.round((endDate - startDate) / (1000 * 60 * 60) * 10) / 10;
      
      const statusBadge = s.hiredWorkerId 
        ? '<span class="badge badge-success">✓ Hired</span>' 
        : s.applicants.length > 0 
          ? `<span class="badge badge-info">${s.applicants.length} Applicant${s.applicants.length > 1 ? 's' : ''}</span>`
          : '<span class="badge badge-warning">Open</span>';
      
      const categoryEmoji = {
        hospitality: '☕', retail: '🛍️', warehouse: '📦', events: '🎉',
        office: '💼', cleaning: '🧹', delivery: '🚚', general: '⚡'
      };
      const categoryBadge = s.category ? `<span class="badge" style="background: rgba(59,130,246,0.2); color: #60a5fa;">${categoryEmoji[s.category] || '⚡'} ${s.category}</span>` : '';
      
      const skillsHtml = s.requiredSkills && s.requiredSkills.length > 0 
        ? `<div class="shift-meta-item"><span>🎯</span><span>${s.requiredSkills.join(', ')}</span></div>` 
        : '';
      
      const dresscodeHtml = s.dresscode 
        ? `<div class="shift-meta-item"><span>👔</span><span>${s.dresscode}</span></div>` 
        : '';
      
      const requirementsHtml = s.requirements 
        ? `<div class="shift-meta-item"><span>📜</span><span>${s.requirements}</span></div>` 
        : '';
      
      card.innerHTML = `
        <div class="shift-header">
          <div style="flex: 1;">
            <h4 class="shift-title">${s.title}</h4>
            <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
              ${statusBadge}
              ${categoryBadge}
            </div>
          </div>
          <div class="shift-rate">${rate}<span style="font-size: 14px; color: var(--muted); font-weight: 400;">/hr</span></div>
        </div>
        
        <div class="shift-meta">
          <div class="shift-meta-item">
            <span>📅</span>
            <span>${toLocal(s.start)}</span>
          </div>
          <div class="shift-meta-item">
            <span>⏱️</span>
            <span>${durationHours}h</span>
          </div>
          <div class="shift-meta-item">
            <span>📍</span>
            <span>${s.location.suburb || ''}, ${s.location.state} ${s.location.postcode}</span>
          </div>
          ${skillsHtml}
          ${dresscodeHtml}
          ${requirementsHtml}
        </div>
        
        ${s.description ? `<div class="shift-description">${s.description}</div>` : ''}
        
        <div class="shift-actions" id="actions-${s.id}"></div>
        
        <div class="shift-stats">
          <div class="shift-stat">
            <span>👥</span>
            <span>${s.applicants.length} applicant${s.applicants.length !== 1 ? 's' : ''}</span>
          </div>
          ${s.hiredWorkerId ? `<div class="shift-stat"><span>✓</span><span>Worker hired</span></div>` : ''}
          ${s.checkins && s.checkins.length > 0 ? `<div class="shift-stat"><span>⏰</span><span>${s.checkins.length} check-in${s.checkins.length !== 1 ? 's' : ''}</span></div>` : ''}
        </div>
      `;
      listEl.appendChild(card);
      await renderActions(s);
    }
  } catch (e) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);"><div style="font-size: 48px; margin-bottom: 16px;">⚠️</div><div>Failed to load shifts</div></div>';
  }
}

async function getMeSafe() {
  try { return await api('/api/me'); } catch (e) { return null; }
}

async function renderActions(shift) {
  const me = await getMeSafe();
  const actions = document.getElementById(`actions-${shift.id}`);
  actions.innerHTML = '';
  if (!me) { actions.innerHTML = '<div class="muted">🔒 Please sign in to interact</div>'; return; }
  if (me.role === 'worker') {
    const isApplied = shift.applicants.includes(me.id);
    const applyBtn = document.createElement('button');
    applyBtn.textContent = isApplied ? '✓ Applied' : '📝 Apply Now';
    applyBtn.disabled = isApplied;
    if (isApplied) applyBtn.className = 'secondary';
    applyBtn.onclick = async () => { 
      setButtonLoading(applyBtn, true);
      try {
        await api(`/api/shifts/${shift.id}/apply`, { method: 'POST' }); 
        showToast('success', 'Applied!', 'You have successfully applied for this shift.');
        await refreshShifts(); 
      } catch (e) {
        setButtonLoading(applyBtn, false);
        showToast('error', 'Application failed', e.message);
      }
    };
    actions.appendChild(applyBtn);
    if (shift.hiredWorkerId === me.id) {
      const ci = document.createElement('button');
      ci.textContent = '✓ Check in';
      ci.onclick = async () => { 
        setButtonLoading(ci, true);
        try {
          await api(`/api/shifts/${shift.id}/checkin`, { method: 'POST' }); 
          showToast('success', 'Checked in!', 'Have a great shift!');
          await refreshShifts(); 
        } catch (e) {
          setButtonLoading(ci, false);
          showToast('error', 'Check-in failed', e.message);
        }
      };
      const co = document.createElement('button');
      co.className = 'secondary';
      co.textContent = '🚪 Check out';
      co.onclick = async () => { 
        setButtonLoading(co, true);
        try {
          await api(`/api/shifts/${shift.id}/checkout`, { method: 'POST' }); 
          showToast('success', 'Checked out!', 'Great work today!');
          await refreshShifts(); 
        } catch (e) {
          setButtonLoading(co, false);
          showToast('error', 'Check-out failed', e.message);
        }
      };
      actions.appendChild(ci);
      actions.appendChild(co);
    }
  }
  if (me.role === 'employer' && me.id === shift.employerId) {
    if (shift.applicants.length === 0) {
      const b = document.createElement('div');
      b.className = 'muted';
      b.textContent = '👥 No applicants yet';
      actions.appendChild(b);
    } else {
      for (const uid of shift.applicants) {
        // Fetch applicant profile
        let workerName = uid.slice(0, 8) + '…';
        let workerSkills = '';
        let ratingHtml = '';
        try {
          const workerProfile = await api(`/api/profile/${uid}`);
          if (workerProfile.profile?.firstName && workerProfile.profile?.lastName) {
            workerName = `${workerProfile.profile.firstName} ${workerProfile.profile.lastName}`;
          }
          if (workerProfile.profile?.skills && workerProfile.profile.skills.length > 0) {
            workerSkills = ` (${workerProfile.profile.skills.slice(0, 2).join(', ')})`;
          }
          if (workerProfile.rating && workerProfile.rating.count > 0) {
            const stars = '⭐'.repeat(Math.round(workerProfile.rating.average));
            ratingHtml = `<div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${stars} ${workerProfile.rating.average.toFixed(1)} (${workerProfile.rating.count} reviews)</div>`;
          }
        } catch (e) {
          // Profile not available, use ID
        }
        
        const container = document.createElement('div');
        container.style.cssText = 'margin: 8px 0; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;';
        
        const info = document.createElement('div');
        info.style.cssText = 'margin-bottom: 8px; font-size: 14px;';
        info.innerHTML = `<strong>👤 ${workerName}</strong>${workerSkills}${ratingHtml}`;
        container.appendChild(info);
        
        const hireBtn = document.createElement('button');
        const isHired = shift.hiredWorkerId === uid;
        hireBtn.textContent = isHired ? '✓ Hired' : '✅ Hire This Worker';
        hireBtn.disabled = isHired;
        if (isHired) hireBtn.className = 'secondary';
        hireBtn.onclick = async () => { 
          setButtonLoading(hireBtn, true);
          try {
            await api(`/api/shifts/${shift.id}/hire`, { method: 'POST', body: JSON.stringify({ workerId: uid }) }); 
            showToast('success', 'Worker hired!', 'The worker has been notified.');
            await refreshShifts(); 
          } catch (e) {
            setButtonLoading(hireBtn, false);
            showToast('error', 'Hiring failed', e.message);
          }
        };
        container.appendChild(hireBtn);
        actions.appendChild(container);
      }
    }
  }
}

function onRoleChange() {
  const role = document.getElementById('role').value;
  document.getElementById('abnField').style.display = role === 'employer' ? 'block' : 'none';
}

function toIsoFromLocal(local) {
  try { return new Date(local).toISOString(); } catch (e) { return null; }
}

async function main() {
  document.getElementById('role').addEventListener('change', onRoleChange);
  
  document.getElementById('loginBtn').onclick = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    const msg = document.getElementById('authMsg');
    msg.textContent = '';
    
    // Validation
    if (!validateEmail(email)) {
      showToast('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!validatePassword(password)) {
      showToast('error', 'Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    
    setButtonLoading(btn, true);
    try { 
      await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }); 
      showToast('success', 'Welcome back!', 'Successfully logged in.');
      await refreshMe(); 
      await refreshShifts(); 
    } catch (e) { 
      setButtonLoading(btn, false);
      const errorMessages = {
        'invalid_credentials': 'Invalid email or password.',
        'missing_fields': 'Please fill in all fields.'
      };
      showToast('error', 'Login Failed', errorMessages[e.message] || e.message);
      msg.textContent = 'ログイン失敗';
    }
  };
  
  document.getElementById('registerBtn').onclick = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const abn = document.getElementById('abn').value.trim();
    const btn = document.getElementById('registerBtn');
    const msg = document.getElementById('authMsg');
    msg.textContent = '';
    
    // Validation
    if (!validateEmail(email)) {
      showToast('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!validatePassword(password)) {
      showToast('error', 'Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    if (role === 'employer' && !validateABN(abn)) {
      showToast('error', 'Invalid ABN', 'Please enter a valid 11-digit Australian Business Number.');
      return;
    }
    
    setButtonLoading(btn, true);
    try { 
      await api('/api/register', { method: 'POST', body: JSON.stringify({ email, password, role, abn }) }); 
      showToast('success', 'Account Created!', 'Welcome to Timin!');
      await refreshMe(); 
      await refreshShifts(); 
    } catch (e) { 
      setButtonLoading(btn, false);
      const errorMessages = {
        'email_exists': 'This email is already registered.',
        'invalid_abn': 'Invalid Australian Business Number.',
        'missing_fields': 'Please fill in all required fields.'
      };
      showToast('error', 'Registration Failed', errorMessages[e.message] || e.message);
      msg.textContent = '登録失敗';
    }
  };

  document.getElementById('saveProfileBtn').onclick = async () => {
    const firstName = document.getElementById('profileFirstName').value.trim();
    const lastName = document.getElementById('profileLastName').value.trim();
    const phoneNumber = document.getElementById('profilePhone').value.trim();
    const bio = document.getElementById('profileBio').value.trim();
    const btn = document.getElementById('saveProfileBtn');
    const msg = document.getElementById('profileMsg');
    msg.textContent = '';
    
    const profileData = { firstName, lastName, phoneNumber, bio };
    
    // Add role-specific fields
    const me = await getMeSafe();
    if (me?.role === 'worker') {
      const skillsStr = document.getElementById('profileSkills').value.trim();
      profileData.skills = skillsStr ? skillsStr.split(',').map(s => s.trim()).filter(s => s) : [];
    } else if (me?.role === 'employer') {
      profileData.companyName = document.getElementById('profileCompanyName').value.trim();
      profileData.businessType = document.getElementById('profileBusinessType').value;
    }
    
    setButtonLoading(btn, true);
    try {
      console.log('Sending profile data:', profileData);
      const result = await api('/api/me/profile', { method: 'PUT', body: JSON.stringify(profileData) });
      console.log('Profile update result:', result);
      showToast('success', 'Profile Updated!', 'Your profile has been saved successfully.');
      msg.textContent = '✓ 保存しました';
      await refreshMe();
      setButtonLoading(btn, false);
    } catch (e) {
      console.error('Profile update error:', e);
      setButtonLoading(btn, false);
      const errorDetail = e.message || e.data?.error || 'Failed to update profile';
      showToast('error', 'Update Failed', errorDetail);
      msg.textContent = `❌ 保存失敗: ${errorDetail}`;
    }
  };

  document.getElementById('refreshBtn').onclick = refreshShifts;
  // ヘッダーナビのスムーススクロール
  document.querySelectorAll('.nav a').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  document.getElementById('mineOnly').onchange = refreshShifts;

  document.getElementById('createShiftBtn').onclick = async () => {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const hourlyRateAUD = Number(document.getElementById('hourlyRateAUD').value);
    const category = document.getElementById('category').value;
    const dresscode = document.getElementById('dresscode').value.trim();
    const requirements = document.getElementById('requirements').value.trim();
    const requiredSkillsStr = document.getElementById('requiredSkills').value.trim();
    const requiredSkills = requiredSkillsStr ? requiredSkillsStr.split(',').map(s => s.trim()).filter(s => s) : [];
    const state = document.getElementById('state').value;
    const suburb = document.getElementById('suburb').value.trim();
    const postcode = document.getElementById('postcode').value.trim();
    const start = toIsoFromLocal(document.getElementById('start').value);
    const end = toIsoFromLocal(document.getElementById('end').value);
    const btn = document.getElementById('createShiftBtn');
    const msg = document.getElementById('createMsg');
    msg.textContent = '';
    
    // Validation
    if (!title) {
      showToast('error', 'Title Required', 'Please enter a shift title.');
      return;
    }
    if (!hourlyRateAUD || hourlyRateAUD <= 0) {
      showToast('error', 'Invalid Rate', 'Please enter a valid hourly rate.');
      return;
    }
    if (hourlyRateAUD < 15) {
      showToast('warning', 'Low Rate', 'The minimum wage in Australia is around $23/hour. Consider increasing the rate.');
    }
    if (!suburb || !postcode) {
      showToast('error', 'Location Required', 'Please enter suburb and postcode.');
      return;
    }
    if (!start || !end) {
      showToast('error', 'Time Required', 'Please select start and end times.');
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) {
      showToast('error', 'Invalid Time', 'End time must be after start time.');
      return;
    }
    if (startDate < new Date()) {
      showToast('warning', 'Past Date', 'You are creating a shift in the past.');
    }
    
    setButtonLoading(btn, true);
    try {
      await api('/api/shifts', { method: 'POST', body: JSON.stringify({ 
        title, description, hourlyRateAUD, category, requiredSkills, dresscode, requirements,
        location: { state, suburb, postcode }, start, end 
      }) });
      showToast('success', 'Shift Created!', 'Your shift has been posted successfully.');
      msg.textContent = '✓ 作成しました';
      // Clear form
      document.getElementById('title').value = '';
      document.getElementById('description').value = '';
      document.getElementById('hourlyRateAUD').value = '';
      document.getElementById('category').value = 'general';
      document.getElementById('dresscode').value = '';
      document.getElementById('requirements').value = '';
      document.getElementById('requiredSkills').value = '';
      document.getElementById('suburb').value = '';
      document.getElementById('postcode').value = '';
      document.getElementById('start').value = '';
      document.getElementById('end').value = '';
      await refreshShifts();
      setButtonLoading(btn, false);
    } catch (e) {
      setButtonLoading(btn, false);
      const errorMessages = {
        'missing_fields': 'Please fill in all required fields.',
        'invalid_time': 'Invalid time range.',
        'invalid_rate': 'Invalid hourly rate.'
      };
      showToast('error', 'Creation Failed', errorMessages[e.message] || e.message);
      msg.textContent = '❌ 作成失敗';
    }
  };

  await refreshMe();
  await refreshShifts();
}

main();


