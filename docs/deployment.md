# Haven Production Deployment

This project can run as a free public MVP with:

- `api`: FastAPI backend on Render Free Web Service.
- `web`: React/Vite frontend on Vercel Hobby.
- Supabase Free for Postgres, Auth, Storage, and pgvector.

Free tiers are suitable for MVP demos, not guaranteed production SLA. Render Free web services spin down after idle time and can cold start.

## Local CI Commands

```bash
python -m pip install -r requirements-dev.txt
python -m pytest

cd frontend
npm ci
npm run build
```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Create a private Storage bucket named `memories`.
4. Copy the project URL, anon key, service role key, and JWT secret.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

## Render API

Create a Render Web Service from this GitHub repository:

- Runtime: Docker
- Dockerfile: `Dockerfile`
- Plan: Free
- Health check path: `/health`

Or create it from `render.yaml`.

Set these environment variables in Render:

```text
APP_NAME=haven
API_V1_PREFIX=/api
CORS_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:5173,http://127.0.0.1:5173

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_MEMORY_BUCKET=memories

OPENAI_API_KEY=sk-your-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4o-mini

MAX_IMAGE_UPLOAD_BYTES=8388608
ALLOWED_IMAGE_CONTENT_TYPES=image/jpeg,image/png,image/webp
```

After deploy:

```bash
curl https://your-render-api.onrender.com/
curl https://your-render-api.onrender.com/health
curl https://your-render-api.onrender.com/ready
```

`/` explains the API entrypoints, `/health` only confirms the API process is alive, and `/ready` confirms Supabase connectivity.

## Vercel Web

Create a Vercel project from this repository:

- Root Directory: `frontend`
- Framework Preset: Vite
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`

Set these environment variables in Vercel:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=https://your-render-api.onrender.com
```

After the Vercel URL is known, add it to Render `CORS_ORIGINS` and redeploy the API.

## Production Launch Checklist

Before inviting real users, verify the live Render and Vercel deployments end to end:

- Render `/health` returns `ok` and `/ready` returns `ready`.
- Render `CORS_ORIGINS` contains only the production Vercel domain, any staging/preview domain you actively use, and local origins for development.
- Vercel `VITE_API_BASE_URL` points to the Render API, not localhost.
- Vercel `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` point to the production Supabase project.
- Supabase Storage bucket `memories` is private.
- Supabase RLS is enabled on all user-data tables after running `supabase/schema.sql`.
- A real smoke test can sign in, create or join a Haven, save a memory, save a check-in, upload an image, and see the map marker after refresh.
- The app Settings screen shows the expected frontend version and API URL.
- Rollback is documented: redeploy the previous successful Vercel deployment and manually deploy the previous Render commit or image.

## Free Map Check-ins

Haven uses Leaflet with OpenStreetMap tiles for the Love Map, so no Google Maps billing account or API key is required.

Check-ins are stored as memories with `memory_type=check_in`, optional image uploads in the private `memories` bucket, and optional GPS coordinates from the browser Geolocation API. Users must explicitly tap **Check in** before the browser asks for location permission. If they deny permission, they can still save a memory without a map pin.

When applying this schema to an existing Supabase project, run the latest `supabase/schema.sql`; it includes `alter table ... add column if not exists` statements for the new check-in fields.

If the production site still shows an older UI after a push to `main`, check **Vercel > Project > Deployments** and confirm the newest deployment uses the latest commit. The app also shows the frontend build version in **Settings** so you can compare it with the Git commit shown in Vercel. If needed, use **Redeploy** on the latest deployment.

Backend API changes require Render to run the latest commit too. With Blueprint auto deploy enabled this should happen automatically; otherwise use **Render > haven-api > Manual Deploy > Deploy latest commit**.

## GitHub Actions

### CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`.

It checks:

- Backend tests.
- Frontend production build.
- API Docker image build.
- Web Docker image build.

### VPS Deploy

`.github/workflows/deploy.yml` is still available for a paid VPS or self-managed Docker host. It is not required for the free Render + Vercel deployment.

It:

1. Builds API and web Docker images.
2. Pushes them to GitHub Container Registry.
3. Copies `docker-compose.prod.yml` to the server.
4. Pulls and restarts containers over SSH.

## Required GitHub Secrets

Frontend build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Server access:

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_SSH_KEY
DEPLOY_PATH
GHCR_PAT
```

`GHCR_PAT` should be a GitHub personal access token that can read packages from GitHub Container Registry.

Optional GitHub environment variable:

```text
WEB_PORT=80
```

## VPS Server Setup

Install Docker and Docker Compose on the production server.

Create the deploy directory:

```bash
mkdir -p /opt/haven
cd /opt/haven
```

Create `/opt/haven/.env` with backend secrets:

```env
APP_NAME=haven
API_V1_PREFIX=/api

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-legacy-jwt-secret
SUPABASE_MEMORY_BUCKET=memories

OPENAI_API_KEY=sk-your-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4o-mini
```

Never commit this `.env` file.

## First Deploy

Push to `main`, or run the `Deploy Production` workflow manually in GitHub Actions.

After deploy:

```bash
cd /opt/haven
docker compose -f docker-compose.prod.yml ps
curl http://localhost/health
```

## HTTPS

For a real domain, place Caddy, Nginx Proxy Manager, Traefik, or a cloud load balancer in front of the `web` service and terminate TLS there.

## Rollback

In GitHub Actions, rerun a previous successful deploy workflow, or manually set `API_IMAGE` and `WEB_IMAGE` to older image tags and run:

```bash
cd /opt/haven
API_IMAGE=ghcr.io/owner/repo-api:oldsha WEB_IMAGE=ghcr.io/owner/repo-web:oldsha docker compose -f docker-compose.prod.yml up -d
```
