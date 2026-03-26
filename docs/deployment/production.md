# Production Deployment Guide

Hybrid architecture: frontend on edge (Vercel / Cloudflare Pages), backend in Docker on a VPS behind Cloudflare, file storage on a third-party S3-compatible service.

## Prerequisites

- VPS with Docker and Docker Compose (2 GB+ RAM recommended)
- Domain name with DNS managed by Cloudflare
- S3-compatible storage account (Cloudflare R2 recommended — zero egress fees)
- Git access to the repository

## 1. S3 Bucket Setup

Create a bucket on your S3 provider (e.g., Cloudflare R2 dashboard):
- Bucket name: `taskflow-files`
- Generate an API token / access key pair with read+write permissions

Set a CORS policy on the bucket to allow the frontend to load presigned URLs:

```json
[
  {
    "AllowedOrigins": ["https://taskflow.yourdomain.com"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 2. DNS Configuration

In Cloudflare DNS, create:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `api` | `<VPS-IP>` | Proxied (orange cloud) |

Cloudflare terminates TLS. The API Docker container runs plain HTTP on port 3001; Cloudflare proxies HTTPS → HTTP.

For the frontend (if using Cloudflare Pages), the DNS is handled automatically. For Vercel, add a CNAME for the custom domain.

## 3. VPS Setup

```bash
# Install Docker (if not already)
curl -fsSL https://get.docker.com | sh

# Clone repository
git clone <repo-url> /opt/taskflow
cd /opt/taskflow
```

## 4. Configuration

```bash
# Copy and fill in the environment file
cp infra/.env.prod.example infra/.env.prod

# Generate secrets
openssl rand -hex 32  # Use output for ADMIN_TOKEN
openssl rand -hex 32  # Use output for SYSTEM_CONFIG_SECRET
openssl rand -hex 32  # Use output for JWT_SECRET
openssl rand -hex 16  # Use output for POSTGRES_PASSWORD
```

Edit `infra/.env.prod` with your actual values:
- S3 credentials from step 1
- `CORS_ORIGINS` = your frontend domain (e.g., `https://taskflow.yourdomain.com`)
- `DATABASE_URL` password must match `POSTGRES_PASSWORD`

## 5. Deploy Backend

```bash
cd /opt/taskflow/infra

# Build and start services
docker compose -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
docker compose -f docker-compose.prod.yml ps

# Run database migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

Verify:
```bash
curl https://api.yourdomain.com/health
# Expected: {"status":"ok"}
```

## 6. Deploy Frontend

### Option A: Vercel

1. Import the GitHub repository in Vercel
2. Framework preset: Next.js
3. Root directory: `apps/web`
4. Build command: `cd ../.. && pnpm install && pnpm --filter web build`
5. Output directory: `.next`
6. Environment variables:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://api.yourdomain.com`
7. Deploy

### Option B: Cloudflare Pages

1. Connect the GitHub repository in Cloudflare Pages
2. Build command: `pnpm install && pnpm --filter web build`
3. Build output directory: `apps/web/.next`
4. Root directory: `/` (monorepo root)
5. Environment variables:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://api.yourdomain.com`
   - `NODE_VERSION` = `22`
6. Deploy

> **Note**: `NEXT_PUBLIC_API_BASE_URL` is baked into the frontend at build time. If you change the API domain, redeploy the frontend.

## 7. Admin Setup

1. Visit `https://taskflow.yourdomain.com/admin`
2. Enter your `ADMIN_TOKEN`
3. Configure:
   - **SMTP**: Set up email delivery for verification emails and notifications
   - **LLM**: Configure AI provider for task parsing (API key, model, base URL)
   - **App**: Set `app.base_url` to `https://taskflow.yourdomain.com` (used in email verification links)
   - **Auth**: Set `auth.registration_open` to `true` when ready
4. Verify storage: The "Object Storage" card should show a green "Connected" status

## 8. Post-Deploy Verification

- [ ] Register a new account (triggers email verification flow)
- [ ] Upload a file (avatar or task attachment)
- [ ] Create a task with AI parsing (tests LLM + S3 integration)
- [ ] Verify notification emails are delivered
- [ ] Check `/admin` → Storage card shows "Connected"

## Environment Variable Summary

### Backend (VPS `infra/.env.prod`)

| Variable | Description |
|----------|-------------|
| `LISTEN_ADDR` | Server bind address (default `0.0.0.0:3001`) |
| `ADMIN_TOKEN` | Admin panel authentication |
| `SYSTEM_CONFIG_SECRET` | Encrypts secrets in system_config table |
| `JWT_SECRET` | Signs user authentication tokens |
| `DATABASE_URL` | PostgreSQL connection string (docker network) |
| `REDIS_URL` | Redis connection string (docker network) |
| `S3_ENDPOINT` | S3 provider endpoint |
| `S3_ACCESS_KEY` | S3 access key |
| `S3_SECRET_KEY` | S3 secret key |
| `S3_BUCKET` | S3 bucket name |
| `S3_USE_SSL` | Enable HTTPS for S3 (default `true`) |
| `S3_REGION` | S3 region (`auto` for R2) |
| `S3_PATH_STYLE` | Path-style addressing (`true` for R2/MinIO) |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) |
| `NOTIFICATION_WORKER_ENABLED` | Enable background notification processing |

### Frontend (Vercel / Cloudflare Pages dashboard)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | API base URL (build-time only) |

### Runtime (Admin panel → `/admin`)

| Setting | Description |
|---------|-------------|
| `app.base_url` | Frontend URL for email links |
| `smtp.*` | Email delivery configuration |
| `llm.*` | AI provider configuration |
| `auth.registration_open` | Allow new registrations |

## Updates

To deploy a new version:

```bash
cd /opt/taskflow
git pull

# Rebuild and restart
cd infra
docker compose -f docker-compose.prod.yml up -d --build

# Apply any new migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

For the frontend, push to the connected Git branch — Vercel / Cloudflare Pages will auto-deploy.
