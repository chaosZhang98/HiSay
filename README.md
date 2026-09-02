# HiSay

Personal AI Agent chat assistant for iOS.

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Mobile | Expo + React Native (iOS) |
| Web dashboard | Next.js 15 |
| Real-time service | Node.js HTTP + official AG-UI SSE + `node-cron` |
| Agent runtime | Pi SDK (`@earendil-works/pi-coding-agent`) |
| LLM | MiMo v2.5 Pro (OpenAI-compatible) |
| Client-server protocol | Official AG-UI HTTP + SSE |
| Database | SQLite (`better-sqlite3`) with hot/cold archival |
| Monorepo | pnpm workspaces |

## Project Structure

```
HiSay/
├── .trae/rules/          # TRAE project rules
├── AGENTS.md               # AI agent onboarding doc
├── apps/
│   ├── mobile/             # Expo + React Native
│   └── web/                # Next.js dashboard + standalone Node service
├── packages/shared/        # Common types and AG-UI protocol
└── package.json            # pnpm workspace root
```

## Quick Start

### Requirements

- Node.js >= 20
- pnpm >= 9
- macOS with Xcode (for iOS builds)

### Install

```bash
pnpm install
```

> Note: pnpm may report a TRAE sandbox warning while cleaning its temp folder. The install itself succeeds; you can ignore the warning or add `/Users/apple/Library/pnpm/_tmp_*` to your sandbox allowlist.

### Environment

Copy `.env.example` and fill in your MiMo API key:

```bash
cp apps/web/.env.example apps/web/.env
```

```env
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_API_KEY=your-api-key-here
MIMO_MODEL=mimo-v2.5-pro
PORT=8080
DB_PATH=./data/agent.db
CRON_SCHEDULE=0 9 * * *
```

### Run

```bash
# Build shared package first
pnpm --filter @hisay/shared build

# Web dashboard
pnpm --filter @hisay/web dev

# Standalone HTTP + AG-UI SSE agent service
pnpm --filter @hisay/web dev:service

# iOS mobile app
pnpm --filter @hisay/mobile ios
```

## Backend Architecture

The backend follows DDD onion architecture:

```
  Infrastructure
  (Pi SDK, SQLite, HTTP/SSE, cron)
       ↑
  Application
  (use cases)
       ↑
  Domain
  (entities, repository interfaces)
```

Inner layers do not depend on outer layers. Pi SDK is wrapped behind `IAgentRuntime` so the agent runtime can be swapped later without touching domain logic. Official AG-UI packages stay in infrastructure.

## SQLite Archival Strategy

- Hot data: last 90 days of message content stays in `messages`.
- Cold data: older content is compressed into `archives` after 90 days.
- Deleted: compressed archives are removed after 2 years, keeping only summary metadata.
- Maintenance: `VACUUM` runs every 30 days via cron.

For personal use over 4–5 years, this keeps the database well under 500 MB.

## Notes

- AG-UI / A2UI message types live in `packages/shared/src/agui.ts`. Update them first and sync both clients.
- Next.js routes are read-only dashboard / health endpoints. All mutation and real-time logic belongs to the standalone Node service.
- Do not commit `.env` or `data/` files.
