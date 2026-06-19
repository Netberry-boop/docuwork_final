# DocuWork

> Production-ready document digitization workforce platform.

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp .env.example .env
# Fill in .env (DATABASE_URL, JWT_SECRET, Vercel Blob token, SMTP)

# 2. Start services
docker compose up -d

# 3. Run migrations + seed
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

## Local Dev

```bash
npm install
cp .env.example .env    # configure your values
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev             # http://localhost:3000
```

## Default Accounts (after seed)

| Role        | Email                        | Password       |
|-------------|------------------------------|----------------|
| Super Admin | superadmin@docuwork.app      | superadmin123  |
| Manager     | manager@docuwork.app         | manager123     |
| Worker 1    | worker1@docuwork.app         | worker123      |
| Worker 2    | worker2@docuwork.app         | worker123      |
| Worker 3    | worker3@docuwork.app         | worker123      |

## API Endpoints

### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Logout

### Tasks
- `GET    /api/tasks` — List tasks (filtered by role)
- `POST   /api/tasks` — Create task (Manager+)
- `GET    /api/tasks/:id` — Get task details
- `PATCH  /api/tasks/:id` — Update task
- `DELETE /api/tasks/:id` — Delete task
- `POST   /api/tasks/:id/submit` — Submit / save draft (Worker)
- `GET    /api/tasks/:id/submit` — Get latest submission
- `POST   /api/tasks/:id/review` — Review submission (Manager+)

### Workers
- `GET  /api/workers` — List workers
- `POST /api/workers` — Create worker

### Documents
- `GET  /api/documents` — List documents
- `POST /api/documents` — Upload document (multipart)

### Analytics
- `GET /api/analytics/dashboard` — Dashboard stats

### Notifications
- `GET   /api/notifications` — Get notifications
- `PATCH /api/notifications` — Mark all as read

## Deployment

### Vercel + Railway (recommended)
1. Deploy DB on Railway (PostgreSQL)
2. Set env vars in Vercel
3. `vercel deploy`

### Self-hosted Docker
```bash
docker compose -f docker-compose.yml up -d
```

### Environment Variables Required

```
DATABASE_URL=           # PostgreSQL connection string
JWT_SECRET=             # Min 32 chars, random string
BLOB_READ_WRITE_TOKEN=  # Vercel Blob upload/delete token
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
NEXT_PUBLIC_APP_URL=    # Your deployed URL
```

## Architecture

```
src/
├── app/
│   ├── api/              # Next.js API routes (backend)
│   │   ├── auth/         # Login, refresh, logout
│   │   ├── tasks/        # CRUD + submit + review
│   │   ├── workers/      # Worker management
│   │   ├── documents/    # Upload + list
│   │   ├── notifications/
│   │   └── analytics/
│   ├── (public)/         # Login, register
│   ├── (admin)/          # Manager dashboards
│   └── (worker)/         # Worker dashboards + workspace
├── components/
│   └── shared/           # AppShell sidebar/header
├── lib/
│   ├── auth.ts           # JWT + argon2
│   ├── db.ts             # Prisma singleton
│   ├── api.ts            # Request helpers + RBAC middleware
│   ├── storage.ts        # Vercel Blob upload/delete
│   ├── email.ts          # Nodemailer templates
│   └── client.ts         # Frontend API client
├── store/
│   └── auth.ts           # Zustand auth state
prisma/
├── schema.prisma         # Full DB schema
└── seed.ts               # Dev seed data
```

## Production Checklist

- [ ] Set strong JWT_SECRET (32+ chars)
- [ ] Configure Vercel Blob storage
- [ ] Configure SMTP for email delivery
- [ ] Run `prisma migrate deploy` (not push)
- [ ] Set NEXT_PUBLIC_APP_URL to your domain
- [ ] Enable HTTPS (Vercel/Nginx handles this)
- [ ] Set up error monitoring (Sentry DSN)
- [ ] Configure Redis for rate limiting
- [ ] Restrict CORS for your domain
- [ ] Review and rotate default seed passwords
- [ ] Verify uploaded Blob URLs are reachable from your frontend domain
- [ ] Set up database backups
