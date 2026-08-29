# Frontend Rules: agent-ios-app/mobile

## Stack

- Expo SDK 52+ with `expo-router`
- React Native 0.76+ (New Architecture enabled)
- TypeScript
- Tamagui or React Native built-in styling (choose one and stay consistent)
- React Query / SWR for server state
- Zustand for local client state

## iOS Specifics

1. Target iOS 16+ only.
2. Use SafeAreaView and respect dynamic island / notch.
3. Use platform-specific native modules for audio, haptics, and notifications.
4. Keep bundle size small; tree-shake unused AG-UI message types.

## WebSocket / AG-UI Client

1. Use a single WebSocket connection singleton per active user session.
2. Serialize/deserialize AG-UI events through the `shared` package types.
3. Handle reconnection with exponential backoff (max 30s).
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
