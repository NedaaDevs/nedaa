# Athkar Audio/UI Sync Fix — Design

**Goal:** Eliminate all audio/UI desync by merging sync-critical audio state into the main athkar store and enforcing single-writer rules.

**Architecture:** One Zustand store for all sync-critical state. One atomic `transitionTrack` action replaces 5 sequential cross-store calls. Focus screen becomes a pure reader — no more competing effects.

## Root Cause

Two Zustand stores (`athkarStore` + `athkarAudioStore`) mutated by three actors (player singleton, focus screen effects, user taps) with no coordination. When a track changes, the player makes 5 sequential store calls across both stores. Between each call, React can re-render with intermediate states — showing the wrong thikr, double-counting, or killing audio on mount.

## What Moves Where

### Into `athkarStore` (sync-critical — must update atomically)

- `playerState: PlayerState`
- `currentAthkarId: string | null`
- `currentThikrId: string | null`
- `repeatProgress: { current: number; total: number }`
- `sessionProgress: { current: number; total: number }`

### Stays in `athkarAudioStore` (preferences + high-frequency data)

**Persisted preferences** (unrelated to sync):
- `playbackMode`, `selectedReciterId`, `repeatLimit`, `comfortMode`, `onboardingCompleted`

**High-frequency playback data** (would cause excessive re-renders in main store):
- `position`, `duration`

**UI state:**
- `showBottomSheet`

**Download state:**
- `downloads`, `downloadProgress`, `totalStorageUsed`

### Deleted (dead code)

- `showCompletion` — set in `handleSessionComplete` but never read by any UI component

## New Action: `transitionTrack`

Added to `athkarStore`. Replaces 5 separate store calls with one atomic `set()`:

```typescript
transitionTrack: (params: {
  previousAthkarId: string | null;
  newAthkarId: string;
  newThikrId: string;
  repeatProgress: { current: number; total: number };
  sessionProgress: { current: number; total: number };
  newIndex: number;
}) => void;
```

Inside one `set()` call:
1. Increments count for `previousAthkarId` (if non-null)
2. Sets `currentAthkarId`, `currentThikrId`
3. Sets `repeatProgress`, `sessionProgress`
4. Sets `currentAthkarIndex` to `newIndex`

No intermediate renders. No race conditions.

## Single Writer Rule

| State field | Sole writer |
|---|---|
| `currentAthkarIndex` | `transitionTrack`, `moveToNext`, `moveToPrevious`, `findOptimalAthkarIndex` |
| `currentProgress[]` | `incrementCount` (with audio guard), `transitionTrack` |
| `playerState` | Player singleton via `setPlayerState` |
| `currentAthkarId` | Player singleton via `transitionTrack` |

Focus screen effects NEVER write `currentAthkarIndex`. They only read it.

## Audio Guard on `incrementCount`

Prevents double-counting when user taps while audio plays:

```typescript
incrementCount: (athkarId, skipAutoMove) => {
  const { playerState, currentAthkarId } = get();
  if (playerState === "playing" && currentAthkarId === athkarId) return;
  // ... normal logic
}
```

Audio playing a thikr = only the player can increment that thikr's count. User taps on OTHER thikrs still work.

## Smart Pause Reorder

Before (UI stale for 1500ms):
```
incrementCount → pause → sleep(1500ms) → play → setCurrentTrack → setIndex
```

After (UI updates instantly):
```
transitionTrack (atomic UI update) → setPlayerState("loading") → pause → sleep → play → setPlayerState("playing")
```

## Focus Screen Fixes

### Delete: audio sync effect
```typescript
// REMOVE — player handles this via transitionTrack
useEffect(() => {
  if (currentAthkarId && ...) setCurrentAthkarIndex(idx)
}, [currentAthkarId, playerState]);
```

### Delete: `hasSettled` ref
No longer needed — single writer means no cascading index writes on mount.

### Fix: `shortVersion` effect (SF-10)
Use a ref to skip mount:
```typescript
const prevShortVersion = useRef(shortVersion);
useEffect(() => {
  if (prevShortVersion.current !== shortVersion) {
    prevShortVersion.current = shortVersion;
    if (playerState !== "idle") athkarPlayer.stop();
  }
}, [shortVersion]);
```

## Files Changed

| File | Change |
|---|---|
| `src/types/athkar.ts` | Add audio state fields + `transitionTrack` to types |
| `src/types/athkar-audio.ts` | Remove moved fields from types |
| `src/stores/athkar.ts` | Add audio state, `transitionTrack`, audio guard on `incrementCount` |
| `src/stores/athkar-audio.ts` | Remove moved fields, keep preferences + position/duration |
| `src/services/athkar-player.ts` | Use `transitionTrack`, reorder smart pause, write to one store |
| `src/app/athkar-focus.tsx` | Delete sync effect, delete `hasSettled`, fix `shortVersion` |
| `src/components/athkar/AthkarCard.tsx` | Import `playerState`/`currentAthkarId` from `useAthkarStore` |
| `src/components/athkar/AudioControls.tsx` | Import `playerState`/`repeatProgress` from `useAthkarStore` |
| `src/components/athkar/PlayerBottomSheet.tsx` | Import moved fields from `useAthkarStore` |
| `src/components/athkar/MiniPlayerBar.tsx` | Import `playerState`/`sessionProgress` from `useAthkarStore` |
| `src/components/athkar/AthkarTabs.tsx` | Import `playerState` from `useAthkarStore` |
| `src/components/athkar/AudioSettings.tsx` | No change (only uses preferences) |
| `src/components/athkar/AudioOnboarding.tsx` | No change (only uses preferences) |
| `src/app/settings/athkar-audio-debug.tsx` | Import moved fields from `useAthkarStore` |
| `src/utils/sound.ts` | Import `playerState` from `useAthkarStore` |

## Sync Failure Points Resolved

| ID | Issue | Resolution |
|---|---|---|
| SF-1 | Double `setCurrentAthkarIndex` | Delete focus screen sync effect |
| SF-2 | `incrementCount` before `setCurrentTrack` | Atomic `transitionTrack` |
| SF-3 | Smart pause stale UI (1500ms) | Reorder: UI updates before pause |
| SF-10 | `shortVersion` kills audio on mount | Ref guard skips first render |
| SF-11 | Mount effects conflict | No more competing writers |
| SF-14 | Double-counting | Audio guard on `incrementCount` |
| SF-15 | Insufficient tap guard | Audio guard covers all modes |
