// Pure (no RN / file-system deps) helpers for the diagnostics logger: session-marker
// formatting/parsing, age + global-size pruning, and the shared diagnostic bundle.
// Kept side-effect-free so they're unit-testable; appLogger.ts owns the I/O.

// Marker written once per app session at the head of that session's entries. Carries
// the date (entries themselves are time-only) so logs can be pruned by age, and the
// app version so a file shows which build wrote each session.
export const sessionMarker = (stamp: string, version: string, build: string): string =>
  `=== session ${stamp} · v${version} (${build}) ===`;

export const SESSION_MARKER_RE = /^=== session (\d{4}-\d{2}-\d{2}) \d{2}:\d{2} · /gm;

export interface SessionSpan {
  date: Date;
  markerStart: number;
}

export const parseSessions = (text: string): SessionSpan[] => {
  const spans: SessionSpan[] = [];
  SESSION_MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SESSION_MARKER_RE.exec(text)) !== null) {
    spans.push({ date: new Date(`${m[1]}T00:00:00Z`), markerStart: m.index });
  }
  return spans;
};

// Drop every session older than `now - maxDays`. If all sessions are stale, keep the
// most recent one for minimal context. Orphan text before the first marker is dropped.
export const pruneByAge = (text: string, now: Date, maxDays: number): string => {
  const spans = parseSessions(text);
  if (spans.length === 0) return "";
  const cutoff = now.getTime() - maxDays * 24 * 60 * 60 * 1000;
  const firstKept = spans.find((s) => s.date.getTime() >= cutoff);
  const keepFrom = firstKept ? firstKept.markerStart : spans[spans.length - 1].markerStart;
  return text.slice(keepFrom);
};

const byteLen = (s: string): number => {
  // Buffer exists under jest/node; Hermes falls back to Blob. Typed via globalThis
  // because @types/node isn't in the RN type roots.
  const B = (globalThis as { Buffer?: { byteLength: (v: string, enc: string) => number } }).Buffer;
  return B ? B.byteLength(s, "utf8") : new Blob([s]).size;
};

// Bound total log size by dropping whole session segments across all domains, oldest
// session date first, until under maxBytes. A domain trimmed to nothing returns "".
export const pruneGlobalBySize = (
  files: { domain: string; text: string }[],
  maxBytes: number
): { domain: string; text: string }[] => {
  const work = files.map((f) => ({ ...f }));
  const total = () => work.reduce((n, f) => n + byteLen(f.text), 0);
  while (total() > maxBytes) {
    let oldest: { fi: number; nextStart: number; date: number } | null = null;
    for (let fi = 0; fi < work.length; fi++) {
      const spans = parseSessions(work[fi].text);
      if (spans.length === 0) continue;
      const d = spans[0].date.getTime();
      if (!oldest || d < oldest.date) {
        const nextStart = spans.length > 1 ? spans[1].markerStart : work[fi].text.length;
        oldest = { fi, nextStart, date: d };
      }
    }
    if (!oldest) break;
    work[oldest.fi].text = work[oldest.fi].text.slice(oldest.nextStart);
  }
  return work;
};

export interface BundleInput {
  header: [string, string][];
  category?: string;
  description?: string;
  sections: { domain: string; text: string }[];
}

// One authoritative header (no per-domain headers), optional category + description,
// then each non-empty domain section. This is what the user shares.
export const buildBundle = (input: BundleInput): string => {
  const pad = Math.max(...input.header.map(([k]) => k.length)) + 1;
  const headerLines = input.header.map(([k, v]) => `${(k + ":").padEnd(pad + 1)} ${v}`);
  const parts: string[] = ["NEDAA DIAGNOSTIC REPORT", ...headerLines];
  if (input.category) parts.push(`Category: ${input.category}`);
  parts.push("----------------------------------------");
  if (input.description) parts.push("User description:", input.description);
  parts.push("========================================");
  for (const s of input.sections) {
    if (!s.text.trim()) continue;
    parts.push(`====== ${s.domain.toUpperCase()} ======`, s.text);
  }
  return parts.join("\n") + "\n";
};
