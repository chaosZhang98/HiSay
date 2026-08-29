# Backend Rules: agent-ios-app/web & agent service

## Architecture: DDD Onion

The backend is split into two deployable units:

1. **Next.js 15 web dashboard**: admin UI, health checks, read-only analytics.
2. **Standalone Node.js service**: WebSocket server + Pi SDK + cron jobs.

The standalone service must follow Domain-Driven Design (onion architecture):

```
  ┌─────────────────────────────────────┐
  │           Infrastructure            │
  │  (WebSocket server, DB, Pi SDK, cron)│
  ├─────────────────────────────────────┤
  │         Application Layer           │
  │  (use cases, DTOs, mappers)         │
  ├─────────────────────────────────────┤
  │          Domain Layer               │
  │  (entities, repositories interfaces,│
  │   domain services, invariants)      │
  ├─────────────────────────────────────┤
  │          Core / Shared              │
  └─────────────────────────────────────┘
```

### Dependency Rule

Inner layers must not depend on outer layers. Outer layers depend on inner layers via interfaces.

### Layer Responsibilities

- **Domain**: entities (`Conversation`, `Message`, `ScheduledTask`), value objects, domain events, repository interfaces.
- **Application**: orchestration use cases (`SendMessage`, `CreateScheduledTask`, `RunDueTasks`).
- **Infrastructure**: concrete repository implementations (SQLite), Pi SDK wrapper (`AgentGateway`), WebSocket server, cron scheduler, MiMo client.

## Model Configuration: MiMo v2.5 Pro

- Base URL: `https://api.xiaomimimo.com/v1`
- Model ID: `mimo-v2.5-pro`
- Use OpenAI-compatible `/chat/completions` endpoint.
- Pay-per-use: track input/output tokens for diagnostics (do not bill).
- Fallback behavior: if model fails, surface error to client; do not silently retry more than once.

## Persistence: SQLite + better-sqlite3

1. Use `better-sqlite3` for local embedded DB.
2. One DB per deployment (`data/agent.db`).
3. Schema versioned via SQL migrations in `src/infrastructure/db/migrations/`.
4. Tables:
   - `conversations`
   - `messages`
   - `scheduled_tasks`
   - `archives` (cold data)
   - `events` (append-only domain events)

### Hot / Cold Archival Strategy

- Keep last 90 days of message content in `messages` table (hot).
- After 90 days, compress message text and move to `archives` table (cold), retaining metadata in `messages`.
- Run VACUUM every 30 days via cron job.
- Delete archived compressed content after 2 years, keeping only summary metadata.
- Estimate: 4–5 years of personal use stays well under 500 MB.

## WebSocket Server

1. Use `ws` library.
2. One connection per authenticated device.
3. Protocol: AG-UI / A2UI messages encoded as JSON.
4. Broadcast agent streaming deltas to the owning connection only.
5. Ping/pong every 30s; drop unresponsive clients after 2 missed pongs.

## Cron / Scheduled Push

1. Use `node-cron` inside the standalone service.
2. Cron expression configurable via `CRON_SCHEDULE` env var.
3. Jobs are stored in `scheduled_tasks`; due tasks trigger an AG-UI message to the connected client.
4. Idempotency key per task execution to prevent duplicate pushes.

## Pi SDK Integration

1. Wrap Pi SDK (`@earendil-works/pi-coding-agent`) behind an `AgentGateway` interface in the infrastructure layer.
2. Gateway implements domain interface `IAgentGateway`.
3. This allows swapping Pi for another agent runtime later without touching domain logic.
4. Pi configuration lives in `src/infrastructure/agent/pi.config.ts`.

## API / Routes

1. Next.js routes are read-only dashboard / health endpoints only.
2. Mutation and real-time logic belong to the standalone Node service.

## Environment Variables

Required:

- `MIMO_BASE_URL`
- `MIMO_API_KEY`
- `MIMO_MODEL`
- `WS_PORT`
- `DB_PATH`
- `CRON_SCHEDULE`

## Error Handling

1. Domain errors use typed `AppError` classes.
2. Infrastructure errors are mapped to domain errors at the boundary.
3. Never leak stack traces or secrets in client responses.
