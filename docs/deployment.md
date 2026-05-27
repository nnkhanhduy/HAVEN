# Haven Production Deployment

This project deploys as two Docker containers:

- `api`: FastAPI backend.
- `web`: Nginx serving the React app and proxying `/api` to `api`.

## Local CI Commands

```bash
python -m pip install -r requirements-dev.txt
python -m pytest

cd frontend
npm ci
npm run build
```

## GitHub Actions

### CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`.

It checks:

- Backend tests.
- Frontend production build.
- API Docker image build.
- Web Docker image build.

### Production Deploy

`.github/workflows/deploy.yml` runs on pushes to `main` and can also be run manually.

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

## Server Setup

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
