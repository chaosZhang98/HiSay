# AGENTS.md

## Project

Personal AI Agent chat assistant for iOS, backed by a Node.js WebSocket service.

## Repositories

- GitHub TBD. Local monorepo at `agent-ios-app/`.

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Mobile | Expo + React Native (iOS) |
| Web dashboard | Next.js 15 |
| Real-time service | Node.js + `ws` + `node-cron` |
| Agent runtime | Pi SDK (`@earendil-works/pi-coding-agent`) |
| LLM | MiMo v2.5 Pro (OpenAI-compatible) |
| Client-server protocol | AG-UI / A2UI over WebSocket |
| Database | SQLite (`better-sqlite3`) with hot/cold archival |
| Monorepo | pnpm workspaces |

## Architecture

- Mobile app communicates with the backend exclusively via WebSocket using AG-UI/A2UI event types.
- Backend is split:
  - Next.js web dashboard: read-only UI, health, analytics.
  - Standalone Node service: DDD onion architecture. Domain at the center; Pi SDK and SQLite are infrastructure details.
- Domain entities: `Conversation`, `Message`, `ScheduledTask`.
- Pi SDK is wrapped behind `IAgentGateway` so it can be replaced later.

## Conventions

- TypeScript strict mode everywhere.
- Internal packages use `workspace:*`.
- Cross-package imports go through `packages/shared` public exports.
- Backend follows onion architecture: domain → application → infrastructure.
- No business logic in controllers or WebSocket handlers.

## Environment

See each app's `.env.example` for required variables. Key variables:

- `MIMO_BASE_URL=https://api.xiaomimimo.com/v1`
- `MIMO_MODEL=mimo-v2.5-pro`
- `WS_PORT=8080`
- `DB_PATH=./data/agent.db`

## How to Run (planned)

1. `pnpm install`
2. `pnpm --filter @agent/shared build`
3. `pnpm --filter @agent/web dev` (dashboard)
4. `pnpm --filter @agent/service dev` (WebSocket service)
5. `pnpm --filter @agent/mobile start` (Expo)

## Project Rules

Rules are maintained in hidden `.rules/` directory and synced to both TRAE and Cursor via symlinks:

- `.trae/rules/` → `.rules/` (symlink)
- `.cursor/rules/` → `.rules/` (symlink)

To modify rules, edit files in `.rules/` directory. Changes apply to both tools automatically.

For manual sync (if needed): `./sync-rules.sh`

## Notes for AI Agents

- Do not add new external dependencies without user approval.
- Do not violate the dependency direction of onion architecture.
- Do not store secrets in code; use env vars.
- When modifying AG-UI message types, update `packages/shared` first and sync both clients.
- If modifying project rules, edit files in `.rules/` directory and run `./sync-rules.sh` if needed.
