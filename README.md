# 🕰️ Timin - Flexible Work Marketplace

**Timin** is a modern, production-ready work marketplace platform connecting workers with flexible shift opportunities across Australia. Inspired by successful gig economy platforms, Timin offers a beautiful, intuitive interface for both employers and workers.

## ✨ Features

### 🎯 Core Functionality
- **User Authentication** - Secure sign-up/sign-in with JWT tokens and HttpOnly cookies
- **Dual User Roles** - Separate experiences for workers and employers
- **Shift Management** - Create, browse, and apply for shifts
- **Real-time Updates** - Live shift status and applicant tracking
- **Check-in/Check-out System** - Track work hours for hired workers

### 🇦🇺 Australian Localization
- **AUD Currency** - All payments in Australian Dollars
- **Timezone Support** - Australia/Sydney timezone handling
- **ABN Validation** - Validates Australian Business Numbers for employers
- **State & Postcode** - Proper Australian address handling

### 🎨 Modern UI/UX
- **Responsive Design** - Optimized for mobile, tablet, and desktop
- **Smooth Animations** - Polished transitions and loading states
- **Toast Notifications** - Real-time user feedback
- **Dark Theme** - Eye-friendly color scheme with gradient backgrounds
- **Accessible** - WCAG compliant with proper ARIA labels

### 🔒 Security Features
- **Scrypt Password Hashing** - Industry-standard password encryption
- **HMAC-SHA256 JWT** - Secure token signing
- **Security Headers** - XSS, clickjacking, and MIME-sniffing protection
- **Input Validation** - Client and server-side validation
- **HTTPS Ready** - Secure cookie flags for production

## 🚀 Quick Start

### Requirements
- Node.js v18 or higher (uses native `fetch` and `Intl`)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd autimin
```

2. Start the development server:
```bash
npm run dev
```

The app will automatically open in your browser at http://localhost:3000/

### Production Start
```bash
NODE_ENV=production PORT=3000 npm start
```

## 📖 Usage

### For Workers
1. Sign up with email and password (select "Worker" role)
2. Browse available shifts on the homepage
3. Apply to shifts that interest you
4. Once hired, check in/out when working

### For Employers
1. Sign up with email, password, and valid ABN (select "Employer" role)
2. Create shift postings with details, rates, and times
3. Review applicants for your shifts
4. Hire workers and track their check-ins

### Demo Accounts
The app creates sample accounts on first run:

**Employer Account:**
- Email: `employer@example.com`
- Password: `password123`
- ABN: `51824753556`

**Worker Account:**
- Email: `worker@example.com`
- Password: `password123`

## 🛠️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Secret key for JWT tokens (REQUIRED for production!)
TIMIN_SECRET=your-super-secret-key-change-this

# Development settings
DEV=1
OPEN=1
```

⚠️ **Important:** Change `TIMIN_SECRET` to a strong random string in production!

## 📁 Project Structure

```
autimin/
├── public/           # Frontend assets
│   ├── index.html   # Main HTML file
│   └── app.js       # Client-side JavaScript
├── data/            # JSON data storage
│   ├── users.json   # User accounts
│   ├── shifts.json  # Shift listings
│   └── transparent_timin.png  # Logo
├── server.js        # Node.js backend
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

## 🎨 Tech Stack

### Frontend
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **Modern CSS** - CSS Grid, Flexbox, animations
- **Responsive Design** - Mobile-first approach
- **Web Fonts** - Montserrat from Google Fonts

### Backend
- **Node.js** - Pure Node.js (no external dependencies!)
- **HTTP Server** - Built-in `http` module
- **File-based Storage** - JSON files (no database required)
- **Security** - Scrypt, HMAC-SHA256, secure cookies

## 🔧 API Endpoints

### Authentication
- `POST /api/register` - Create new account
- `POST /api/login` - Sign in
- `POST /api/logout` - Sign out
- `GET /api/me` - Get current user

### Shifts
- `GET /api/shifts` - List all shifts (or `?mine=true` for employer's own)
- `POST /api/shifts` - Create new shift (employer only)
- `POST /api/shifts/:id/apply` - Apply to shift (worker only)
- `POST /api/shifts/:id/hire` - Hire applicant (employer only)
- `POST /api/shifts/:id/checkin` - Check in to shift (hired worker only)
- `POST /api/shifts/:id/checkout` - Check out from shift (hired worker only)

### System
- `GET /health` - Health check endpoint

## 🚀 Deployment

### Production Checklist

1. ✅ Set strong `TIMIN_SECRET` environment variable
2. ✅ Set `NODE_ENV=production`
3. ✅ Use HTTPS in production
4. ✅ Set up proper backup for `data/` directory
5. ✅ Configure firewall and security groups
6. ✅ Set up monitoring and logging
7. ✅ Review and adjust rate limiting if needed

### Deployment Platforms

**Render / Railway / Fly.io:**
```bash
# Set environment variables in dashboard
NODE_ENV=production
TIMIN_SECRET=<your-secret-key>
PORT=3000
```

**Traditional VPS:**
```bash
# Use PM2 or systemd for process management
pm2 start server.js --name timin
```

## 🧪 Testing

1. Start the server: `npm run dev`
2. Open http://localhost:3000/
3. Test user registration and login
4. Create shifts as employer
5. Apply to shifts as worker
6. Test hiring and check-in/out flow

## 📝 Notes

- **Data Storage**: Uses simple JSON files. For production at scale, migrate to a proper database (PostgreSQL, MongoDB, etc.)
- **File Locking**: Atomic writes with temp files, but no distributed locking
- **Scaling**: Single-process design. Use load balancer with sticky sessions if scaling horizontally
- **HTTPS**: Required for production (secure cookies, sensitive data)

## 🤝 Contributing

This is a portfolio/demonstration project, but suggestions and improvements are welcome!

## 📄 License

MIT License - feel free to use this project as a learning resource or starting point for your own application.

## 🎯 Future Enhancements

- [ ] Real-time notifications (WebSockets)
- [ ] Payment processing integration
- [ ] Ratings and reviews system
- [ ] Advanced search and filters
- [ ] Email notifications
- [ ] Multi-language support
- [ ] Database migration (PostgreSQL)
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Mobile apps (iOS/Android)

---

**Made with ❤️ for the Australian gig economy**


