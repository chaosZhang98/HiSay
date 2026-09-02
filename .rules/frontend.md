# Frontend Rules: HiSay/mobile

## Stack

- Expo SDK 54 (`apps/mobile`, entry `index.ts`)
- React Native 0.81 (New Architecture enabled)
- TypeScript
- Tamagui or React Native built-in styling (choose one and stay consistent)
- React Query / SWR for server state
- Zustand for local client state

## iOS Specifics

1. Target iOS 16+ only.
2. Use SafeAreaView and respect dynamic island / notch.
3. Use platform-specific native modules for audio, haptics, and notifications.
4. Keep bundle size small; tree-shake unused AG-UI message types.

## HTTP / AG-UI Client

1. Agent runs go through `IAgentTransport` (current impl: official `HttpAgent`).
2. Chat screens must not import `EventType` from `@ag-ui/core`.
3. A2UI bricks register on `IComponentCatalog`; do not hard-wire one tool to one screen.
4. Show connection status in the chat UI.

## State Management

1. Separate "conversation state" from "UI state".
2. Conversation state is append-only event log; UI derives current view.
3. Persist draft user input locally only (AsyncStorage), never full message history.

## Components

1. Keep components under 150 lines. Extract hooks early.
2. Use React.memo for message list items.
3. Support dark mode via system preference.

## File Naming

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Screens: `PascalCaseScreen.tsx`
- Utilities: `camelCase.ts`
- Constants: `SCREAMING_SNAKE_CASE.ts`
