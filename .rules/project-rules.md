# Project Rules: agent-ios-app

## Project Overview

Personal AI Agent chat assistant for iOS.

- **Mobile**: Expo + React Native (iOS focused)
- **Backend**: Next.js 15 web dashboard + standalone Node.js WebSocket service
- **Agent engine**: Pi SDK (`@earendil-works/pi-coding-agent`)
- **Model**: MiMo v2.5 Pro (OpenAI-compatible API, pay-per-use)
- **Client-server protocol**: AG-UI / A2UI over WebSocket
- **Monorepo**: pnpm workspace

## Global Constraints

1. Use TypeScript everywhere. Strict mode enabled.
2. Use pnpm workspace protocol `workspace:*` for internal packages.
3. Prefer native APIs and well-typed libraries. Avoid `@ts-ignore`.
4. All code must be formatted by Prettier and pass ESLint.
5. Keep files small and focused. One file per concern.
6. Use absolute imports within each package; cross-package imports must go through the `shared` package public exports.
7. Document public APIs and domain rules in code comments.
8. Never hardcode secrets. Use environment variables and `.env.example` files.
9. Prefer immutable data structures and explicit side-effect boundaries.
10. When in doubt, ask the user before adding new dependencies.
