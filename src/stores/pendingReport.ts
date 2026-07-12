import { create } from "zustand";

// Bumped whenever a crash sentinel is written. CrashReportPrompt reads the sentinel on mount,
// but the native-diagnostics drain writes it asynchronously after that first read; subscribing
// to this nonce lets the prompt re-check when a late sentinel lands in the same session.
interface PendingReportState {
  nonce: number;
  notify: () => void;
}

export const usePendingReportStore = create<PendingReportState>()((set) => ({
  nonce: 0,
  notify: () => set((state) => ({ nonce: state.nonce + 1 })),
}));
