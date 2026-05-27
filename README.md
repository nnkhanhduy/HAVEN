# haven

Digital Sanctuary MVP backend for couples, built with FastAPI, Supabase Postgres/pgvector, and OpenAI.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create a private Supabase Storage bucket named `memories`.
4. Copy `.env.example` to `.env` and fill in secrets.
5. Start the API:

```bash
docker compose up --build
```

The API runs at `http://localhost:8000`.

All protected endpoints require:

```http
Authorization: Bearer <supabase-access-token>
```

Image memories store the Supabase Storage object path in `memories.image_url`. Generate short-lived signed URLs from the backend before exposing images to clients.

## Frontend

The web test UI lives in `frontend/`.

```bash
cd frontend
npm install
npm run dev -- --port 5173
```

Copy `frontend/.env.example` to `frontend/.env` and fill in the Supabase public URL and anon key.

## CI/CD

Production deployment files are included:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `docker-compose.prod.yml`
- `frontend/Dockerfile`

See `docs/deployment.md` for the production setup.
