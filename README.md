# Aravali Interiors — Backend API

NestJS backend for lead management, portfolio, blog, admin dashboard, and integrations.

## Quick Start

### 1. Prerequisites
- Node.js 20+
- Docker & Docker Compose (for PostgreSQL + Redis)

### 2. Start infrastructure
```bash
docker compose up -d postgres redis
```

### 3. Install dependencies
```bash
npm install
```

### 4. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 5. Run database migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 6. Seed database
```bash
npm run prisma:seed
```

### 7. Start development server
```bash
npm run start:dev
```

API available at: `http://localhost:4000/api/v1`
Swagger docs at: `http://localhost:4000/docs`

## Project Structure

```
src/
├── main.ts                 # App bootstrap, security, Swagger
├── app.module.ts           # Root module wiring
├── config/
│   ├── prisma.module.ts    # Database service (global)
│   └── redis.module.ts     # Cache service (global)
├── auth/
│   ├── auth.module.ts      # JWT + Passport setup
│   ├── auth.service.ts     # Login, refresh, user CRUD
│   ├── auth.controller.ts  # POST /auth/login, /auth/refresh
│   ├── jwt.strategy.ts     # Passport JWT strategy
│   └── jwt-auth.guard.ts   # Route guard
├── leads/
│   ├── leads.module.ts
│   ├── leads.dto.ts        # Validated DTOs for 3-step form
│   ├── leads.service.ts    # Full business logic + CRM sync
│   └── leads.controller.ts # Public + Admin endpoints
├── portfolio/
│   └── portfolio.module.ts # Public listing + Admin CRUD
├── blog/
│   └── blog.module.ts      # Public listing + Admin CRUD
├── admin/
│   └── admin.module.ts     # Audit logs, user listing
├── email/
│   ├── email.service.ts    # SendGrid integration
│   └── email.module.ts
├── files/
│   └── files.module.ts     # S3 upload + virus scan
├── calendar/
│   └── calendar.module.ts  # Booking slots + creation
└── common/
    ├── decorators/roles.decorator.ts
    └── guards/roles.guard.ts
```

## API Endpoints

### Public (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /leads | Submit lead (Step 1) |
| PATCH | /leads/:id/step2 | Update with Step 2 data |
| PATCH | /leads/:id/step3 | Update with Step 3 data |
| GET | /leads/resume/:token | Resume saved form |
| POST | /leads/:id/resume-link | Email resume link |
| GET | /portfolio | List projects (filter: sector, city, sustainable) |
| GET | /portfolio/filters | Available filter options |
| GET | /portfolio/:slug | Project detail |
| GET | /blog | List posts (filter: category, search) |
| GET | /blog/:slug | Post detail |
| GET | /booking/slots?date=YYYY-MM-DD | Available booking slots |
| POST | /booking | Create consultation booking |

### Auth
| POST | /auth/login | Admin login → JWT tokens |
| POST | /auth/refresh | Refresh access token |
| GET | /auth/me | Current user (auth required) |

### Admin (JWT required)
| GET | /admin/leads | List leads (filter, sort, paginate) |
| GET | /admin/leads/dashboard | KPIs |
| GET | /admin/leads/export | CSV export |
| GET | /admin/leads/:id | Lead detail + notes + attachments |
| PATCH | /admin/leads/:id | Update status/assignment/tags |
| POST | /admin/leads/:id/notes | Add note |
| POST | /admin/leads/:id/attachments | Upload file |
| CRUD | /admin/portfolio/* | Manage portfolio |
| CRUD | /admin/blog/* | Manage blog |
| GET | /admin/audit-logs | View audit trail |
| GET | /admin/users | List admin users |

## Key Features
- **Progressive 3-step lead form** with save & resume via email token
- **Auto-routing** by city → region with priority escalation for large deals
- **CRM sync** to HubSpot/Salesforce or generic webhook
- **Slack alerts** for high-priority leads (>₹50Cr or >75K sqft)
- **SendGrid emails** with branded HTML templates
- **S3 file uploads** with virus scan pipeline
- **Role-based access**: ADMIN, MANAGER, SALES, VIEWER
- **Audit logging** for all lead data access
- **Rate limiting** (5 submissions/IP/hour)
- **Input validation** (class-validator whitelist mode)

## Deployment

### Docker
```bash
docker compose up --build
```

### AWS ECS
```bash
docker build -t aravali-api .
docker tag aravali-api:latest <ECR_REPO>:latest
docker push <ECR_REPO>:latest
aws ecs update-service --cluster aravali --service api --force-new-deployment
```

## Default Credentials (seed)
- **Admin**: admin@aravali.in / admin@aravali2026
- **Sales**: sales.west@aravali.in / sales@aravali2026
