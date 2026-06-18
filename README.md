# IIT Ropar FAQ — Crowdsource Knowledge Platform

A crowd-sourced FAQ platform for IIT Ropar where students can browse FAQs, raise queries, and help peers by solving queries. Built with **Next.js 16**, **TypeScript**, and **MongoDB**.

## ✨ Features

- **📚 Browse FAQs** — Search and browse frequently asked questions with real-time search
- **✋ Raise a Query** — Submit questions and receive a unique ticket ID for tracking
- **💡 Solve a Query** — Answer peer queries; 3 peer approvals mark a query as resolved
- **🔒 Admin Panel** — Password-protected dashboard to add and manage FAQs
- **🎨 Premium Dark UI** — Glassmorphism cards, smooth animations, and responsive design

## 🛡️ Security Features

- **SMTP Email Verification** — 6-digit OTP sent on registration; account only activates after email confirmation
- **Google OAuth Login** — One-click sign-in with Google (auto-registers new users)
- **SHA-256 Password Hashing** — Salted hashing using Node.js `crypto` module
- **Password Strength Validation** — Min 8 characters, 1 number, 1 special character
- **Common Pattern Blocking** — Rejects `qwerty`, `12345`, `password`, keyboard walks, repeated/sequential characters
- **3-Attempt Password Lockout** — Account locks after 3 failed login attempts; unlock via SMTP email OTP
- **DDoS Protection** — Progressive 3-tier penalty system (throttle → 5-min ban → 30-min ban)
- **429 Rate Limiting** — Per-IP throttling on all API routes with `Retry-After` headers
- **NoSQL Injection Protection** — `$`-key stripping, regex escaping, ObjectId format validation, input sanitization
- **20-Minute Session Timeout** — Sliding window sessions via HTTP-only cookies
- **Login Timeline Tracking** — Logs every login attempt with IP, user agent, timestamp, and success/fail
- **Permanent Account Deletion** — SMTP email confirmation required (8-char code); deletes all user data
- **User Query Tracking** — Auto-populated "My Queries" section based on logged-in user profile
- **Error Boundary** — Hard reload suggestion with error timestamp on unrecoverable errors

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | MongoDB |
| Auth | SHA-256 hashing + Google OAuth 2.0 + HTTP-only session cookies |
| Email | Nodemailer (SMTP) for OTP verification, lock/unlock, deletion confirmation |
| Security | DDoS protection + rate limiter + 3-attempt lockout + input sanitization |
| Styling | Vanilla CSS (custom design system) |
| Fonts | Inter + Outfit (Google Fonts) |

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **MongoDB** running locally on port `27017`, or a MongoDB Atlas URI
- **SMTP credentials** (Gmail App Password, SendGrid, etc.)
- **Google OAuth credentials** (optional, for Google login)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd iitropar-faq

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Core
MONGODB_URI=mongodb://localhost:27017/iitropar-faq
ADMIN_PASSWORD=your_secure_password
NEXT_PUBLIC_APP_NAME=IIT Ropar FAQ
NEXT_PUBLIC_APP_URL=http://localhost:3000

# SMTP (required for email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=IIT Ropar FAQ <your-email@gmail.com>

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### Running the App

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Pages

| Page | Route | Auth Required | Description |
|------|-------|---------------|-------------|
| Browse FAQs | `/` | No | Home page with search bar and expandable FAQ cards |
| Raise a Query | `/raise-query` | **User login** | Submit a query, track status, view "My Queries" |
| Solve a Query | `/solve-query` | **User login** | Answer active queries or approve proposed solutions |
| Account Settings | `/account` | **User login** | Profile, login history, account deletion |
| Admin Login | `/admin` | No | Password-only admin authentication |
| Admin Dashboard | `/admin/dashboard` | **Admin** | Add new FAQs and manage (delete) existing ones |

## 🔄 Query Lifecycle

```
1. Student logs in (email/password or Google) and raises a query → Ticket ID generated
2. Query status: 🟡 Active — visible in "My Queries" section
3. A logged-in peer submits an answer → Status: 🔵 In Review (1/3 approvals)
4. Two more peers approve → Status: 🟢 Resolved (3/3 approvals)
5. Student can track status via "My Queries" or by entering the ticket ID
```

## 🗂️ Project Structure

```
src/
├── app/
│   ├── globals.css                    # Design system & global styles
│   ├── layout.tsx                     # Root layout with Navbar + ErrorBoundary
│   ├── page.tsx                       # Browse FAQs (home)
│   ├── raise-query/page.tsx           # Raise & track queries (auth required)
│   ├── solve-query/page.tsx           # Solve peer queries (auth required)
│   ├── account/page.tsx               # Account settings & deletion
│   ├── admin/
│   │   ├── page.tsx                   # Admin login
│   │   └── dashboard/page.tsx         # Admin FAQ management
│   └── api/
│       ├── faqs/route.ts              # GET (search/list), POST (add), DELETE (remove)
│       ├── queries/route.ts           # GET (by ticket/status/userId), POST (create)
│       ├── queries/solve/route.ts     # POST (answer/approve)
│       ├── auth/
│       │   ├── register/route.ts      # POST (register + send verification OTP)
│       │   ├── login/route.ts         # POST (login with 3-attempt lockout)
│       │   ├── verify/route.ts        # GET (session check)
│       │   ├── verify-email/route.ts  # POST (verify OTP code)
│       │   ├── resend-otp/route.ts    # POST (resend verification OTP)
│       │   ├── logout/route.ts        # POST (session destroy)
│       │   ├── history/route.ts       # GET (login timeline)
│       │   ├── unlock/route.ts        # POST/PUT (send/verify unlock OTP)
│       │   ├── delete-account/route.ts# POST/DELETE (initiate/confirm deletion)
│       │   ├── google/route.ts        # GET (redirect to Google OAuth)
│       │   └── google/callback/route.ts # GET (handle Google callback)
│       └── admin/
│           ├── login/route.ts         # POST (admin authenticate)
│           └── verify/route.ts        # GET (admin session check)
├── components/
│   ├── Navbar.tsx                     # Navigation with user pill + logout
│   ├── FAQCard.tsx                    # Expandable FAQ card
│   ├── SearchBar.tsx                  # Debounced search input (300ms)
│   ├── StatusTracker.tsx              # Visual step indicator
│   ├── TicketDisplay.tsx              # Ticket ID with copy-to-clipboard
│   ├── ConfirmModal.tsx               # Delete confirmation dialog
│   ├── AuthForm.tsx                   # Login/Register/OTP/Lockout/Google OAuth UI
│   ├── AuthGuard.tsx                  # Auth wrapper with Suspense boundary
│   └── ErrorBoundary.tsx              # Error catch with hard reload button
└── lib/
    ├── mongodb.ts                     # Singleton MongoDB connection
    ├── ticketId.ts                    # Ticket ID generator
    ├── security.ts                    # SHA-256 hashing, password validation, sanitization
    ├── session.ts                     # 20-min sliding window session management
    ├── rateLimit.ts                   # Per-IP rate limiter + account lockout tracking
    ├── email.ts                       # Nodemailer SMTP (verification, lock, unlock, deletion)
    └── ddos.ts                        # 3-tier progressive DDoS protection
```

## 🔌 API Reference

### FAQs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/faqs?q=term` | No | Search FAQs (regex-escaped, rate limited) |
| `POST` | `/api/faqs` | Admin | Add a new FAQ (input sanitized) |
| `DELETE` | `/api/faqs` | Admin | Delete a FAQ by ID (ObjectId validated) |

### Queries

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/queries?ticketId=xxx` | No | Get query by ticket ID |
| `GET` | `/api/queries?userId=xxx` | No | Get all queries by a user |
| `GET` | `/api/queries?status=active` | No | Get a random active/in-review query |
| `POST` | `/api/queries` | **User** | Create a new query (associated with userId) |
| `POST` | `/api/queries/solve` | **User** | Submit answer or approve (tracked by userId) |

### User Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register + send 6-digit OTP via SMTP |
| `POST` | `/api/auth/verify-email` | Verify OTP → activate account + auto-login |
| `POST` | `/api/auth/resend-otp` | Resend verification OTP (3/15min limit) |
| `POST` | `/api/auth/login` | Login with 3-attempt lockout + DDoS check |
| `GET` | `/api/auth/verify` | Check session validity (sliding window) |
| `POST` | `/api/auth/logout` | Destroy session |
| `GET` | `/api/auth/history` | Get last 20 login events |
| `POST` | `/api/auth/unlock` | Send unlock OTP to locked account |
| `PUT` | `/api/auth/unlock` | Verify unlock OTP → unlock account |
| `POST` | `/api/auth/delete-account` | Initiate deletion → sends email confirmation |
| `DELETE` | `/api/auth/delete-account` | Confirm deletion code → permanently delete |

### Google OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/google` | Redirect to Google consent screen |
| `GET` | `/api/auth/google/callback` | Handle callback, auto-register/login, redirect |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Authenticate with admin password |
| `GET` | `/api/admin/verify` | Check admin session |

## 🔐 Password Rules

| Rule | Details |
|------|---------|
| Minimum length | 8 characters |
| Number required | At least 1 digit |
| Special character | At least 1 of `!@#$%^&*()_+-=` etc. |
| No common patterns | Rejects: `password`, `qwerty`, `admin`, `letmein`, etc. |
| No keyboard walks | Rejects: `qwertyui`, `asdfghjk`, `1qaz2wsx`, etc. |
| No repeated chars | Rejects 4+ repeated characters (`aaaa`) |
| No sequential numbers | Rejects `1234`, `4321`, etc. |

## 🛡️ DDoS Protection Tiers

| Tier | Threshold | Action |
|------|-----------|--------|
| Tier 1 | >100 req/min per IP | 429 throttle response |
| Tier 2 | >200 req/min per IP | 5-minute IP ban |
| Tier 3 | >500 req/min per IP | 30-minute IP ban |

## 🔒 Account Lockout Flow

```
1. User enters wrong password → "2 attempts remaining"
2. Second wrong attempt → "1 attempt remaining"
3. Third wrong attempt → 🔒 Account locked for 15 min + email notification
4. User can unlock via "Unlock via Email" → receives OTP → enters code → unlocked
```

## 📝 License

MIT


# team-6a2fd93aa5361d4e855a3c50
FAQ Crowdsourcing project — Vanshika Agrawal
