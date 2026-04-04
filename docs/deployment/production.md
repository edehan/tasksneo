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
docker compose -f docker-compose.prod.yml exec api sh -lc "cd /app/packages/db && ./node_modules/.bin/prisma migrate deploy"
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
   - `NEXT_PUBLIC_CAP_API_ENDPOINT` = `https://cap.yourdomain.com/<site-key>/` (CAPTCHA, omit to disable)
7. Deploy

### Option B: Cloudflare Workers

Next.js apps deploy to Cloudflare Workers via the [OpenNext adapter](https://opennext.js.org/cloudflare). The adapter transforms `next build` output into a Worker that runs on Cloudflare's edge network. Next.js 14–16 are all supported.

#### Workers Builds (recommended — git-connected CI)

1. In Cloudflare dashboard → Workers & Pages → Create → Import a Git repository
2. Select the GitHub repo, then configure:

| Setting | Value |
|---------|-------|
| Build command | `pnpm install && cd apps/web && pnpm run deploy` |
| Root directory | `/` (monorepo root) |

3. Add **Build variables and secrets**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_CAP_API_ENDPOINT` | `https://cap.yourdomain.com/<site-key>/` (omit to disable CAPTCHA) |
| `NODE_VERSION` | `22` |

> The `deploy` script in `apps/web/package.json` runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`, which builds Next.js, transforms the output, and deploys via wrangler — all from the correct directory.

#### Manual deploy from CLI

```bash
cd apps/web
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com pnpm run deploy
```

#### Local preview (runs in workerd runtime)

```bash
cd apps/web
pnpm run preview
```

> **Note**: `NEXT_PUBLIC_API_BASE_URL` is baked into the frontend at build time. If you change the API domain, redeploy the frontend.

## 7. CAPTCHA Setup (Cap.js)

[Cap.js](https://capjs.js.org) is a privacy-first proof-of-work CAPTCHA that protects registration and email-change endpoints from spam bots. Cap is deployed independently (see [Cap Standalone docs](https://capjs.js.org/guide/standalone/)) — it is **not** part of the TaskFlow docker-compose stack.

### Backend

Add to `infra/.env.prod`:

```bash
CAP_ENABLED=true
CAP_URL=https://cap.yourdomain.com/<site-key>   # your Cap instance + site key
CAP_SECRET=<site-secret-key>                     # from Cap dashboard (NOT admin key)
```

Restart the API to pick up the new vars.

### Frontend

Add `NEXT_PUBLIC_CAP_API_ENDPOINT` to your frontend build environment (Vercel / Cloudflare dashboard):

```
NEXT_PUBLIC_CAP_API_ENDPOINT=https://cap.yourdomain.com/<site-key>/
```

When this variable is unset, the CAPTCHA widget is hidden and the backend skips verification — no changes needed for dev/test.

## 8. Admin Setup

1. Visit `https://taskflow.yourdomain.com/admin`
2. Enter your `ADMIN_TOKEN`
3. Configure:
   - **SMTP**: Set up email delivery for verification emails and notifications
   - **LLM**: Configure AI provider for task parsing (API key, model, base URL)
   - **App**: Set `app.base_url` to `https://taskflow.yourdomain.com` (used in email verification links)
   - **Auth**: Set `auth.registration_open` to `true` when ready
4. Verify storage: The "Object Storage" card should show a green "Connected" status

## 9. Post-Deploy Verification

- [ ] Register a new account (CAPTCHA widget should appear, then triggers email verification flow)
- [ ] Upload a file (avatar or task attachment)
- [ ] Create a task with AI parsing (tests LLM + S3 integration)
- [ ] Verify notification emails are delivered
- [ ] Check `/admin` → Storage card shows "Connected"

## 10. Environment Variable Summary

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
| `CAP_ENABLED` | Enable CAPTCHA verification (`true` / unset) |
| `CAP_URL` | Cap instance URL with site key (e.g. `https://cap.example.com/<key>`) |
| `CAP_SECRET` | Cap site secret key (from dashboard) |

### Frontend (Vercel / Cloudflare Pages dashboard)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | API base URL (build-time only) |
| `NEXT_PUBLIC_CAP_API_ENDPOINT` | Cap widget endpoint (build-time, omit to disable CAPTCHA) |

### Runtime (Admin panel → `/admin`)

| Setting | Description |
|---------|-------------|
| `app.base_url` | Frontend URL for email links |
| `smtp.*` | Email delivery configuration |
| `llm.*` | AI provider configuration |
| `auth.registration_open` | Allow new registrations |

## 11. MCP Server Package

The MCP server lets users connect AI tools (Claude Code, Cursor, etc.) to their TaskFlow account. It is distributed as a tarball hosted on the API server.

### Build the package

```bash
cd apps/mcp
pnpm pack
# Output: taskflow-mcp-<version>.tgz
```

### Host on your API server

Serve the tarball as a static file from your API domain. The frontend config snippet generates a URL like:

```
https://api.yourdomain.com/mcp/taskflow-mcp-latest.tgz
```

Option A — Nginx (if running a reverse proxy on the VPS):
```nginx
location /mcp/ {
    alias /opt/taskflow/packages/mcp-dist/;
}
```

Option B — Cloudflare R2 / any static host:
Upload the `.tgz` and make it publicly accessible at the URL above.

### Update workflow

When the MCP server code changes:
```bash
cd apps/mcp
pnpm pack
cp taskflow-mcp-*.tgz /opt/taskflow/packages/mcp-dist/taskflow-mcp-latest.tgz
```

Users run the snippet from the MCP Keys settings page. `npx` downloads the tarball, installs dependencies, and runs the MCP server — no npm registry needed.

### Environment variables (set by the user's AI tool, not on the server)

| Variable | Description |
|----------|-------------|
| `TASKFLOW_API_URL` | API base URL (e.g. `https://api.yourdomain.com`) |
| `TASKFLOW_MCP_KEY` | MCP key generated from the web UI |

## 12. Updates

To deploy a new version:

```bash
cd /opt/taskflow
git pull

# Rebuild and restart
cd infra
docker compose -f docker-compose.prod.yml up -d --build

# Apply any new migrations
docker compose -f docker-compose.prod.yml exec api sh -lc "cd /app/packages/db && ./node_modules/.bin/prisma migrate deploy"
```

For the frontend, push to the connected Git branch — Vercel / Cloudflare Pages will auto-deploy.
