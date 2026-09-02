# AGENTS.md

## Project

HiSay — personal AI agent chat assistant for iOS, backed by a Node.js HTTP service (official AG-UI SSE).

## Repositories

- GitHub TBD. Local monorepo at `HiSay/`.

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Mobile | Expo SDK 54 + React Native 0.81 (iOS) |
| Web dashboard | Next.js 15 |
| Real-time service | Node.js + `ws` + `node-cron` |
| Agent runtime | Pi SDK (`@earendil-works/pi-coding-agent`) |
| LLM | MiMo v2.5 Pro (OpenAI-compatible) |
| Client-server protocol | Official AG-UI over HTTP + SSE |
| Database | SQLite (`better-sqlite3`) with hot/cold archival |
| Monorepo | pnpm workspaces |

## Architecture

- Mobile app talks to the backend via HTTP: `POST /agent` (official AG-UI SSE) plus REST for conversations and tasks.
- Backend is split:
  - Next.js web dashboard: read-only UI, health, analytics.
  - Standalone Node service: DDD onion architecture. Domain at the center; Pi SDK and SQLite are infrastructure details.
- Domain entities: `Conversation`, `Message`, `ScheduledTask`.
- Pi SDK is wrapped behind `IAgentRuntime` so it can be replaced later (Honey / DeepFlow).

## Conventions

- TypeScript strict mode everywhere.
- Internal packages use `workspace:*`.
- Cross-package imports go through `packages/shared` public exports.
- Backend follows onion architecture: domain → application → infrastructure.
- No business logic in HTTP handlers.

## Environment

See each app's `.env.example` for required variables. Key variables:

- `MIMO_BASE_URL=https://api.xiaomimimo.com/v1`
- `MIMO_MODEL=mimo-v2.5-pro`
- `PORT=8080`
- `DB_PATH=./data/agent.db`

## How to Run (planned)

1. `pnpm install`
2. `pnpm --filter @hisay/shared build`
3. `pnpm --filter @hisay/web dev` (dashboard)
4. `pnpm --filter @hisay/web dev:service` (HTTP + AG-UI SSE service)
5. `pnpm --filter @hisay/mobile start` (Expo)

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
