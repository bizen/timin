const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { spawn } = require('child_process');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHIFTS_FILE = path.join(DATA_DIR, 'shifts.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const SECRET = (process.env.TIMIN_SECRET || 'dev-secret') + '-hmac';

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf8');
  if (!fs.existsSync(SHIFTS_FILE)) fs.writeFileSync(SHIFTS_FILE, '[]', 'utf8');
  if (!fs.existsSync(REVIEWS_FILE)) fs.writeFileSync(REVIEWS_FILE, '[]', 'utf8');
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || 'null') ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function generateId(prefix) {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

function scryptHash(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64);
  return `scrypt:${usedSalt}:${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hex] = String(stored).split(':');
  if (scheme !== 'scrypt' || !salt || !hex) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hex, 'hex'));
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signToken(payload, maxAgeSec = 60 * 60 * 24 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + maxAgeSec };
  const part1 = base64url(JSON.stringify(header));
  const part2 = base64url(JSON.stringify(body));
  const data = `${part1}.${part2}`;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [part1, part2, sig] = parts;
  const data = `${part1}.${part2}`;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return null;
  try {
    const json = JSON.parse(Buffer.from(part2.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!json.exp || Math.floor(Date.now() / 1000) > json.exp) return null;
    return json;
  } catch (e) {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const map = {};
  if (!cookieHeader) return map;
  const pairs = cookieHeader.split(';');
  for (const p of pairs) {
    const i = p.indexOf('=');
    if (i === -1) continue;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    map[k] = decodeURIComponent(v);
  }
  return map;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

function abnIsValid(abn) {
  const digits = String(abn || '').replace(/[^0-9]/g, '');
  if (digits.length !== 11) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const first = Number(digits[0]) - 1;
  const rest = digits.slice(1).split('').map(Number);
  const nums = [first, ...rest];
  const total = nums.reduce((sum, d, i) => sum + d * weights[i], 0);
  return total % 89 === 0;
}

function ensureSeed() {
  const users = readJson(USERS_FILE, []);
  const shifts = readJson(SHIFTS_FILE, []);
  if (users.length === 0) {
    const employerId = generateId('usr');
    const workerId = generateId('usr');
    users.push(
      { id: employerId, email: 'employer@example.com', role: 'employer', passwordHash: scryptHash('password123'), abn: '51824753556' },
      { id: workerId, email: 'worker@example.com', role: 'worker', passwordHash: scryptHash('password123') }
    );
    writeJson(USERS_FILE, users);
  }
  if (shifts.length === 0) {
    const employer = readJson(USERS_FILE, []).find(u => u.role === 'employer');
    if (employer) {
      const now = new Date();
      const start = new Date(now.getTime() + 24 * 3600 * 1000);
      const end = new Date(start.getTime() + 4 * 3600 * 1000);
      const s = {
        id: generateId('sft'),
        employerId: employer.id,
        title: 'Cafe Barista (Casual)',
        description: 'Help morning rush. Basic coffee making. Friendly attitude.',
        hourlyRateCents: 2850,
        location: { state: 'NSW', postcode: '2000', suburb: 'Sydney' },
        start: start.toISOString(),
        end: end.toISOString(),
        applicants: [],
        hiredWorkerId: null,
        checkins: []
      };
      shifts.push(s);
      writeJson(SHIFTS_FILE, shifts);
    }
  }
}

async function readRequestBody(req) {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req) {
  const cookies = parseCookies(req.headers['cookie']);
  const token = cookies['timin_token'];
  const payload = verifyToken(token);
  if (!payload) return null;
  const users = readJson(USERS_FILE, []);
  const user = users.find(u => u.id === payload.uid);
  return user || null;
}

function setAuthCookie(res, token, maxAgeSec) {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFlag = isProduction ? '; Secure' : '';
  const cookie = `timin_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  const secureFlag = isProduction ? '; Secure' : '';
  const cookie = `timin_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`;
  res.setHeader('Set-Cookie', cookie);
}

function serveStatic(req, res, urlObj) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let filePath = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
  if (filePath.includes('..')) return false;
  const abs = path.join(PUBLIC_DIR, filePath);
  if (!abs.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(abs)) return false;
  const ext = path.extname(abs).toLowerCase();
  const type = (
    ext === '.html' ? 'text/html; charset=utf-8' :
    ext === '.js' ? 'text/javascript; charset=utf-8' :
    ext === '.css' ? 'text/css; charset=utf-8' :
    ext === '.json' ? 'application/json; charset=utf-8' :
    'application/octet-stream'
  );
  const content = fs.readFileSync(abs);
  const headers = { 
    'Content-Type': type, 
    'Content-Length': content.length,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
  // Cache static assets
  if (ext === '.js' || ext === '.css') {
    headers['Cache-Control'] = 'public, max-age=3600';
  } else if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache';
  }
  res.writeHead(200, headers);
  res.end(content);
  return true;
}

function serveAssets(req, res, urlObj) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (urlObj.pathname !== '/assets/transparent_timin.png') return false;
  const abs = path.join(DATA_DIR, 'transparent_timin.png');
  if (!fs.existsSync(abs)) return false;
  const content = fs.readFileSync(abs);
  // Use shorter cache in development, longer in production
  const isProduction = process.env.NODE_ENV === 'production';
  const cacheControl = isProduction ? 'public, max-age=86400' : 'public, max-age=60';
  res.writeHead(200, { 
    'Content-Type': 'image/png', 
    'Cache-Control': cacheControl, 
    'Content-Length': content.length 
  });
  res.end(content);
  return true;
}

function isEmployer(user) { return user && user.role === 'employer'; }
function isWorker(user) { return user && user.role === 'worker'; }

async function handleApi(req, res, urlObj) {
  // Authentication & session
  if (req.method === 'POST' && urlObj.pathname === '/api/register') {
    const body = await readRequestBody(req);
    const { email, password, role, abn } = body;
    if (!email || !password || !role) return sendJson(res, 400, { error: 'missing_fields' });
    if (!['worker','employer'].includes(role)) return sendJson(res, 400, { error: 'invalid_role' });
    if (role === 'employer' && (!abn || !abnIsValid(abn))) return sendJson(res, 400, { error: 'invalid_abn' });
    const users = readJson(USERS_FILE, []);
    if (users.some(u => u.email === email)) return sendJson(res, 409, { error: 'email_exists' });
    const user = { id: generateId('usr'), email, role, passwordHash: scryptHash(password) };
    if (role === 'employer') user.abn = String(abn);
    users.push(user);
    writeJson(USERS_FILE, users);
    const token = signToken({ uid: user.id, role: user.role });
    setAuthCookie(res, token, 60 * 60 * 24 * 7);
    return sendJson(res, 201, { id: user.id, email: user.email, role: user.role });
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/login') {
    const body = await readRequestBody(req);
    const { email, password } = body;
    if (!email || !password) return sendJson(res, 400, { error: 'missing_fields' });
    const users = readJson(USERS_FILE, []);
    const user = users.find(u => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { error: 'invalid_credentials' });
    const token = signToken({ uid: user.id, role: user.role });
    setAuthCookie(res, token, 60 * 60 * 24 * 7);
    return sendJson(res, 200, { id: user.id, email: user.email, role: user.role });
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/logout') {
    clearAuthCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/me') {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: 'unauthorized' });
    return sendJson(res, 200, { id: user.id, email: user.email, role: user.role, profile: user.profile || {} });
  }

  if (req.method === 'PUT' && urlObj.pathname === '/api/me/profile') {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 403, { error: 'forbidden' });
    
    const body = await readRequestBody(req);
    const { firstName, lastName, phoneNumber, bio, companyName, businessType, skills, englishLevel } = body;
    const users = readJson(USERS_FILE, []);
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) return sendJson(res, 404, { error: 'user_not_found' });
    
    if (!users[idx].profile) users[idx].profile = {};
    if (firstName !== undefined) users[idx].profile.firstName = String(firstName).trim();
    if (lastName !== undefined) users[idx].profile.lastName = String(lastName).trim();
    if (phoneNumber !== undefined) users[idx].profile.phoneNumber = String(phoneNumber).trim();
    if (bio !== undefined) users[idx].profile.bio = String(bio).trim();
    
    if (user.role === 'employer') {
      if (companyName !== undefined) users[idx].profile.companyName = String(companyName).trim();
      if (businessType !== undefined) users[idx].profile.businessType = String(businessType).trim();
    }
    
    if (user.role === 'worker') {
      if (englishLevel !== undefined) users[idx].profile.englishLevel = String(englishLevel).trim();
      if (Array.isArray(skills)) users[idx].profile.skills = skills.map(s => String(s).trim()).filter(s => s);
    }
    
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { ok: true, profile: users[idx].profile });
  }

  const profileMatch = urlObj.pathname.match(/^\/api\/profile\/([^\/]+)$/);
  if (req.method === 'GET' && profileMatch) {
    const userId = profileMatch[1];
    const users = readJson(USERS_FILE, []);
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return sendJson(res, 404, { error: 'user_not_found' });
    
    // Get user's rating
    const reviews = readJson(REVIEWS_FILE, []);
    const userReviews = reviews.filter(r => r.revieweeId === userId);
    const avgRating = userReviews.length > 0 
      ? Math.round((userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length) * 10) / 10
      : 0;
    
    return sendJson(res, 200, { 
      id: targetUser.id, 
      email: targetUser.email, 
      role: targetUser.role, 
      profile: targetUser.profile || {},
      rating: { average: avgRating, count: userReviews.length }
    });
  }

  // Shifts
  if (req.method === 'GET' && urlObj.pathname === '/api/shifts') {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: 'unauthorized' });
    const shifts = readJson(SHIFTS_FILE, []);
    const mine = urlObj.searchParams.get('mine') === 'true';
    const result = mine && isEmployer(user) ? shifts.filter(s => s.employerId === user.id) : shifts;
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/shifts') {
    const user = getAuthUser(req);
    if (!user || !isEmployer(user)) return sendJson(res, 403, { error: 'forbidden' });
    const body = await readRequestBody(req);
    const { title, description, hourlyRateAUD, location, start, end, category, requiredSkills, dresscode, requirements } = body;
    if (!title || !hourlyRateAUD || !location || !start || !end) return sendJson(res, 400, { error: 'missing_fields' });
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!(startDate instanceof Date) || isNaN(startDate) || !(endDate instanceof Date) || isNaN(endDate) || endDate <= startDate) {
      return sendJson(res, 400, { error: 'invalid_time' });
    }
    const rateCents = Math.round(Number(hourlyRateAUD) * 100);
    if (!Number.isFinite(rateCents) || rateCents <= 0) return sendJson(res, 400, { error: 'invalid_rate' });
    const shifts = readJson(SHIFTS_FILE, []);
    const s = {
      id: generateId('sft'),
      employerId: user.id,
      title: String(title),
      description: String(description || ''),
      hourlyRateCents: rateCents,
      category: category || 'general',
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      dresscode: String(dresscode || ''),
      requirements: String(requirements || ''),
      location: {
        state: location.state || 'NSW',
        postcode: String(location.postcode || ''),
        suburb: String(location.suburb || '')
      },
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      applicants: [],
      hiredWorkerId: null,
      checkins: []
    };
    shifts.push(s);
    writeJson(SHIFTS_FILE, shifts);
    return sendJson(res, 201, s);
  }

  const shiftApplyMatch = urlObj.pathname.match(/^\/api\/shifts\/([^\/]+)\/apply$/);
  if (req.method === 'POST' && shiftApplyMatch) {
    const user = getAuthUser(req);
    if (!user || !isWorker(user)) return sendJson(res, 403, { error: 'forbidden' });
    const shiftId = shiftApplyMatch[1];
    const shifts = readJson(SHIFTS_FILE, []);
    const s = shifts.find(x => x.id === shiftId);
    if (!s) return sendJson(res, 404, { error: 'not_found' });
    if (!s.applicants.includes(user.id)) s.applicants.push(user.id);
    writeJson(SHIFTS_FILE, shifts);
    return sendJson(res, 200, { ok: true });
  }

  const shiftHireMatch = urlObj.pathname.match(/^\/api\/shifts\/([^\/]+)\/hire$/);
  if (req.method === 'POST' && shiftHireMatch) {
    const user = getAuthUser(req);
    if (!user || !isEmployer(user)) return sendJson(res, 403, { error: 'forbidden' });
    const body = await readRequestBody(req);
    const shiftId = shiftHireMatch[1];
    const workerId = String(body.workerId || '');
    const shifts = readJson(SHIFTS_FILE, []);
    const s = shifts.find(x => x.id === shiftId);
    if (!s) return sendJson(res, 404, { error: 'not_found' });
    if (s.employerId !== user.id) return sendJson(res, 403, { error: 'forbidden' });
    if (!s.applicants.includes(workerId)) return sendJson(res, 400, { error: 'not_applied' });
    s.hiredWorkerId = workerId;
    writeJson(SHIFTS_FILE, shifts);
    return sendJson(res, 200, { ok: true });
  }

  const shiftCheckinMatch = urlObj.pathname.match(/^\/api\/shifts\/([^\/]+)\/checkin$/);
  if (req.method === 'POST' && shiftCheckinMatch) {
    const user = getAuthUser(req);
    if (!user || !isWorker(user)) return sendJson(res, 403, { error: 'forbidden' });
    const shiftId = shiftCheckinMatch[1];
    const shifts = readJson(SHIFTS_FILE, []);
    const s = shifts.find(x => x.id === shiftId);
    if (!s) return sendJson(res, 404, { error: 'not_found' });
    if (s.hiredWorkerId !== user.id) return sendJson(res, 403, { error: 'forbidden' });
    const nowIso = new Date().toISOString();
    const record = s.checkins.find(c => c.userId === user.id && !c.checkoutAt);
    if (record) return sendJson(res, 400, { error: 'already_checked_in' });
    s.checkins.push({ userId: user.id, checkinAt: nowIso, checkoutAt: null });
    writeJson(SHIFTS_FILE, shifts);
    return sendJson(res, 200, { ok: true });
  }

  const shiftCheckoutMatch = urlObj.pathname.match(/^\/api\/shifts\/([^\/]+)\/checkout$/);
  if (req.method === 'POST' && shiftCheckoutMatch) {
    const user = getAuthUser(req);
    if (!user || !isWorker(user)) return sendJson(res, 403, { error: 'forbidden' });
    const shiftId = shiftCheckoutMatch[1];
    const shifts = readJson(SHIFTS_FILE, []);
    const s = shifts.find(x => x.id === shiftId);
    if (!s) return sendJson(res, 404, { error: 'not_found' });
    if (s.hiredWorkerId !== user.id) return sendJson(res, 403, { error: 'forbidden' });
    const record = s.checkins.find(c => c.userId === user.id && !c.checkoutAt);
    if (!record) return sendJson(res, 400, { error: 'not_checked_in' });
    record.checkoutAt = new Date().toISOString();
    writeJson(SHIFTS_FILE, shifts);
    return sendJson(res, 200, { ok: true });
  }

  // Reviews
  if (req.method === 'POST' && urlObj.pathname === '/api/reviews') {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 403, { error: 'forbidden' });
    const body = await readRequestBody(req);
    const { shiftId, revieweeId, rating, comment } = body;
    if (!shiftId || !revieweeId || !rating) return sendJson(res, 400, { error: 'missing_fields' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return sendJson(res, 400, { error: 'invalid_rating' });
    
    const shifts = readJson(SHIFTS_FILE, []);
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return sendJson(res, 404, { error: 'shift_not_found' });
    
    // Check if user is involved in the shift
    const isEmployer = user.role === 'employer' && shift.employerId === user.id;
    const isWorker = user.role === 'worker' && shift.hiredWorkerId === user.id;
    if (!isEmployer && !isWorker) return sendJson(res, 403, { error: 'not_involved' });
    
    const reviews = readJson(REVIEWS_FILE, []);
    
    // Check if already reviewed
    const existingReview = reviews.find(r => r.shiftId === shiftId && r.reviewerId === user.id);
    if (existingReview) return sendJson(res, 409, { error: 'already_reviewed' });
    
    const review = {
      id: generateId('rev'),
      shiftId,
      reviewerId: user.id,
      reviewerRole: user.role,
      revieweeId,
      rating: Number(rating),
      comment: String(comment || '').trim(),
      createdAt: new Date().toISOString()
    };
    
    reviews.push(review);
    writeJson(REVIEWS_FILE, reviews);
    return sendJson(res, 201, review);
  }

  const reviewsUserMatch = urlObj.pathname.match(/^\/api\/reviews\/user\/([^\/]+)$/);
  if (req.method === 'GET' && reviewsUserMatch) {
    const userId = reviewsUserMatch[1];
    const reviews = readJson(REVIEWS_FILE, []);
    const userReviews = reviews.filter(r => r.revieweeId === userId);
    const avgRating = userReviews.length > 0 
      ? userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length 
      : 0;
    return sendJson(res, 200, { reviews: userReviews, avgRating, count: userReviews.length });
  }

  const reviewsShiftMatch = urlObj.pathname.match(/^\/api\/reviews\/shift\/([^\/]+)$/);
  if (req.method === 'GET' && reviewsShiftMatch) {
    const shiftId = reviewsShiftMatch[1];
    const reviews = readJson(REVIEWS_FILE, []);
    const shiftReviews = reviews.filter(r => r.shiftId === shiftId);
    return sendJson(res, 200, shiftReviews);
  }

  return null; // not handled
}

function createServer() {
  ensureDataFiles();
  ensureSeed();

  const server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);

      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      if (urlObj.pathname.startsWith('/api/')) {
        const handled = await handleApi(req, res, urlObj);
        if (handled === null) return sendJson(res, 404, { error: 'not_found' });
        return;
      }

      // Health check endpoint
      if (urlObj.pathname === '/health') {
        return sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      }

      const didAsset = serveAssets(req, res, urlObj);
      if (didAsset) return;

      const didServe = serveStatic(req, res, urlObj);
      if (didServe) return;

      return sendText(res, 404, 'Not Found');
    } catch (e) {
      console.error('Server Error:', e);
      return sendJson(res, 500, { error: 'server_error' });
    }
  });

  return server;
}

const server = createServer();
server.listen(PORT, HOST, () => {
  console.log(`Timin server running at http://localhost:${PORT}`);
  const flag = String(process.env.DEV || process.env.OPEN || '').toLowerCase();
  const shouldOpen = flag === '' ? Boolean(process.env.DEV || process.env.OPEN) : !['0','false','no','off'].includes(flag);
  if (shouldOpen) {
    const url = `http://localhost:${PORT}`;
    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
      } else if (platform === 'win32') {
        spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref();
      } else {
        spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
      }
    } catch (e) {
      // ignore open error
    }
  }
});


