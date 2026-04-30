# ExitWise

Knowledge transfer platform. Captures tacit expertise from retiring employees through AI-guided sessions and makes it accessible to successors.

## What it does

- **Retirees** complete 6 structured AI sessions to capture institutional knowledge
- **Successors** query that knowledge via an AI chat interface
- **Organization admins** manage members, assignments, and knowledge releases

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | Bun, custom HTTP server (`server.ts`) |
| Database | PostgreSQL (via `postgres` driver) |
| AI | Google Gemini API
| Auth | JWT |
| State | Zustand |
| Routing | React Router v7 |

## Getting started

**Prerequisites:** Bun, PostgreSQL

```bash
# Install dependencies
bun install

# Set environment variables
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, ANTHROPIC_API_KEY

# Start dev server (frontend + backend)
bun run dev
```

Frontend: `http://localhost:5173` — API: `http://localhost:8080`

Vite proxies `/api/*` to the backend. If either port is occupied, dev exits with the conflict instead of silently rebinding.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `GEMINI_API_KEY` | Yes | Google Gemini (knowledge capture sessions) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude (successor chat) |
| `PORT` | No | API server port (default: 8080) |

## Build

```bash
bun run build   # TypeScript check + Vite bundle → dist/
bun run start   # Serve production build
```

## User roles

| Role | Access |
|------|--------|
| `organization_admin` | Manage org, members, assign retirees to successors, release profiles |
| `retiree` | Complete AI-guided knowledge capture sessions |
| `successor` | Chat with released knowledge profiles |
