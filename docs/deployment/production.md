# Production Deployment Guide

## Architecture Options

This system supports two deployment architectures. Choose based on your expected load and operational preference.

### Option A: All-in-One VPS (Recommended Default)

Web + API + PostgreSQL + Redis all run in Docker on a single VPS.

```
User → VPS (Caddy/Cloudflare)
         ├── Next.js Web (Docker)
         │     └── SSR prefetch → API via Docker internal network (<1ms)
         ├── API (Docker)
         ├── PostgreSQL (Docker)
         └── Redis (Docker)
```

**Pros:** SSR prefetch runs over the Docker internal network with near-zero latency, simple to operate, single deployment target.

**Cons:** Web and API share the same machine resources; traffic spikes affect both.

**Recommended for:** Most deployments. A 2–4 GB VPS handles typical classroom-scale load comfortably.

---

### Option B: Split Deployment (High-Traffic)

Web on Vercel (auto-scaling), API + Redis + Worker on VPS, database on managed PostgreSQL (e.g. Neon).

```
User → Vercel Edge (static assets, CDN)
         └── Vercel SSR Function
               └── SSR prefetch → VPS API (public internet)

User → VPS API (business logic, BullMQ workers)
         └── Managed PostgreSQL (Neon / Supabase)
```

**Pros:** Web scales automatically with Vercel; VPS only handles API traffic; managed DB provides read replicas for global distribution.

**Cons:** SSR prefetch crosses the public internet to reach the API. This adds latency to every server-rendered page load.

> **Critical prerequisite:** You must pin the Vercel Function region (Project Settings → Functions → Region) to the same geographic region as your VPS. If the Vercel Function runs in Virginia and your VPS is in Singapore, every SSR page load incurs 150–200 ms of extra latency — negating the benefit of SSR. When co-located in the same region, the overhead is typically under 10 ms.

**Recommended for:** Deployments expecting high concurrent web traffic, or where you want to offload SSR compute from the VPS entirely.

---

## Prerequisites

- VPS with Docker and Docker Compose (2 GB+ RAM recommended)
- Domain name with DNS managed by Cloudflare
- S3-compatible storage account (Cloudflare R2 recommended — zero egress fees)
- Git access to the repository
- (Option B only) Managed PostgreSQL account (Neon `aws-ap-southeast-1` for Singapore, etc.)

## 1. S3 Bucket Setup

Create a bucket on your S3 provider (e.g., Cloudflare R2 dashboard):
- Bucket name: `taskflow-files`
- Generate an API token / access key pair with read+write permissions

Set a CORS policy on the bucket to allow the frontend to load and upload
through presigned URLs:

```json
[
  {
    "AllowedOrigins": ["https://taskflow.yourdomain.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 2. DNS Configuration

In Cloudflare DNS, create:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `taskflow` | `<VPS-IP>` | Proxied (orange cloud) |
| A | `api` | `<VPS-IP>` | Proxied (orange cloud) |

Cloudflare terminates TLS at the edge, then Caddy terminates TLS on the VPS and proxies to local Docker ports. The API and Web containers run plain HTTP bound to `127.0.0.1`.

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
cp infra/.env.example infra/.env

# Generate secrets
openssl rand -hex 32  # Use output for ADMIN_TOKEN
openssl rand -hex 32  # Use output for SYSTEM_CONFIG_SECRET
openssl rand -hex 16  # Use output for POSTGRES_PASSWORD
```

Edit `infra/.env` with your actual values:
- S3 credentials from step 1
- `CORS_ORIGINS` = your frontend domain (e.g., `https://taskflow.yourdomain.com`)
- `DATABASE_URL` — for Option A this points to the local postgres container; for Option B use your managed PostgreSQL connection string

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

### Option A: All-in-One VPS

The `docker-compose.prod.yml` includes a `web` service that builds and runs Next.js alongside the API. No separate frontend deployment is needed.

The web container uses `API_INTERNAL_URL=http://api:3001` for SSR prefetch, keeping all server-side data fetching on the Docker internal network.

#### Caddy reverse proxy with direct static file serving

For higher concurrency, let Caddy serve Next.js static chunks directly from the host instead of sending every `/_next/static/*` request to the Next.js server. This keeps static asset traffic from competing with SSR and API calls.

Install Caddy on the VPS, then create the host-side static directory:

```bash
sudo mkdir -p /opt/taskflow-static/_next/static /opt/taskflow-static/public
sudo chown -R "$USER":"$USER" /opt/taskflow-static
```

After the `web` image has been built and started, copy the static output from the container to the host:

```bash
cd /opt/taskflow/infra
./sync-web-static.sh
```

Set `TASKFLOW_STATIC_ROOT=/some/path` if you want Caddy to read static files from a different host directory.

Configure Caddy:

```caddyfile
taskflow.yourdomain.com {
	encode zstd gzip

	handle_path /_next/static/* {
		root * /opt/taskflow-static/_next/static
		header {
			Cache-Control "public, max-age=31536000, immutable"
			match status 2xx
		}
		file_server
	}

	@publicAssets path /manifest.json /robots.txt /apple-touch-icon.png /icon-192.png /icon-512.png
	handle @publicAssets {
		root * /opt/taskflow-static/public
		header {
			Cache-Control "public, max-age=86400"
			match status 2xx
		}
		file_server
	}

	@serviceWorker path /register-sw.js /sw.js
	handle @serviceWorker {
		root * /opt/taskflow-static/public
		header Cache-Control "no-cache"
		file_server
	}

	handle {
		reverse_proxy 127.0.0.1:3000
	}
}

api.yourdomain.com {
	encode zstd gzip

	handle /health* {
		header Cache-Control "no-store"
		reverse_proxy 127.0.0.1:3001
	}

	handle {
		header Cache-Control "no-store"
		reverse_proxy 127.0.0.1:3001
	}
}
```

Validate and reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Verify that static files are served by Caddy with long-lived cache headers:

```bash
curl -I https://taskflow.yourdomain.com/_next/static/chunks/<chunk-file>.js
# Expected: Cache-Control: public, max-age=31536000, immutable
```

Do not long-cache HTML, RSC payloads, private API responses, or `register-sw.js`. Only `/_next/static/*` is safe for one-year immutable caching because Next.js emits content-hashed filenames.

### Option B (Split): Vercel

1. Import the GitHub repository in Vercel
2. Framework preset: Next.js
3. Root directory: `apps/web`
4. Build command: `cd ../.. && pnpm install && pnpm --filter web build`
5. Output directory: `.next`
6. Environment variables:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://api.yourdomain.com`
   - `API_INTERNAL_URL` = `https://api.yourdomain.com` (same as public URL in split mode)
   - `NEXT_PUBLIC_CAP_API_ENDPOINT` = `https://cap.yourdomain.com/<site-key>/` (CAPTCHA, omit to disable)
7. **Pin the Function region** to the same region as your VPS (Project Settings → Functions → Region)
8. Deploy

### Option B (Split): Cloudflare Workers

This Next.js app deploys to Cloudflare Workers via the [OpenNext adapter](https://opennext.js.org/cloudflare).

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

> The `deploy` script in `apps/web/package.json` runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`, which builds Next.js, transforms the output, and deploys via wrangler.

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

Add to `infra/.env`:

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

### Backend (VPS `infra/.env`)

| Variable | Description |
|----------|-------------|
| `LISTEN_ADDR` | Server bind address (default `0.0.0.0:3001`) |
| `ADMIN_TOKEN` | Admin panel authentication |
| `SYSTEM_CONFIG_SECRET` | Encrypts secrets in system_config table |
| `DATABASE_URL` | PostgreSQL connection string |
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

User authentication tokens are opaque session IDs stored in PostgreSQL `sessions`; Redis is used for BullMQ jobs and business caches only.

### Frontend (Vercel / Cloudflare Pages dashboard)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Public API URL used by the browser (build-time) |
| `API_INTERNAL_URL` | API URL used by SSR on the server side; set to internal address when co-located, or same as public URL in split mode |
| `NEXT_PUBLIC_CAP_API_ENDPOINT` | Cap widget endpoint (build-time, omit to disable CAPTCHA) |
| `INSTRUMENTATION_SCRIPT_URLS` | Optional analytics/RUM script URLs, comma-separated (e.g., `/instrumentation/rum.js,https://cdn.example.com/analytics.js`) |

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

If using the Option A Caddy static file setup, sync the latest static output after every rebuild:

```bash
./sync-web-static.sh
sudo systemctl reload caddy
```

For the frontend (split deployment), push to the connected Git branch — Vercel / Cloudflare Pages will auto-deploy.
