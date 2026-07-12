import { File, Directory, Paths } from "expo-file-system";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Clipboard from "expo-clipboard";
import * as Localization from "expo-localization";

import { useDebugModeStore } from "@/stores/debugMode";
import * as Sharing from "expo-sharing";
import { AppState, Platform } from "react-native";

import { sessionMarker, pruneByAge, pruneGlobalBySize, buildBundle } from "@/utils/logBundle";

// Logging convention (keep shared diagnostic bundles signal, not noise):
//   ERROR — a failure that breaks a user-visible operation; pass the Error.
//   WARN  — a recovered failure or data-integrity anomaly worth seeing in a report.
//   INFO  — low-frequency lifecycle that builds a diagnostic timeline (download
//           start/done, session start/stop, resets). NOT per-frame/per-tap/per-track.
//   DEBUG — dev-only, never persisted: routine/high-frequency chatter and traces.
// `tag` is a short area label ("Download", "Player"); the message says what happened,
// the identifier, and the outcome.

const logDir = new Directory(Paths.document, "logs");
const FLUSH_INTERVAL = 5000; // 5 seconds
const FLUSH_THRESHOLD = 20; // entries
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // global cap across all logs/*.log (no per-domain cap)
const MAX_AGE_DAYS = 30;

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const registry: Map<string, DomainLogger> = new Map();

// Extra report sections from other subsystems (e.g. the background-task SQLite log).
// Providers are registered at module load and rendered into every full bundle.
const sectionProviders: Map<string, () => Promise<string>> = new Map();

let dirReady = false;

function ensureLogDir(): void {
  if (dirReady) return;
  if (!logDir.exists) {
    logDir.create({ intermediates: true });
  }
  dirReady = true;
}

// All domains with a .log file on disk, merged with the in-session registry. Reports
// must not depend on the registry alone: after a restart, domains of lazily-loaded
// features (quran, athkar player) have files on disk but no logger yet — a crash
// bundle built from the registry would silently omit the crashing domain's log.
function listDomains(): string[] {
  const domains = new Set(registry.keys());
  try {
    ensureLogDir();
    for (const entry of logDir.list()) {
      if (entry instanceof File && entry.name.endsWith(".log")) {
        domains.add(entry.name.slice(0, -".log".length));
      }
    }
  } catch {
    // fall back to registry-only
  }
  return [...domains];
}

export function getInstallSource(): string {
  if (__DEV__) return "Development";
  if (Platform.OS === "ios") return "App Store";
  return "Production";
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d} ${formatTime(date)}`;
}

// Dated marker written once per session at the head of that session's entries (entries
// are time-only). Enables age pruning and stamps the build that wrote the session.
function sessionMarkerNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  return sessionMarker(
    stamp,
    Application.nativeApplicationVersion ?? "unknown",
    Application.nativeBuildVersion ?? "?"
  );
}

// Write a report bundle to the cache dir and hand it to the OS share sheet as a file
// (so both platforms attach a .log instead of pasting text into the body).
function writeReportFile(text: string, baseName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  // A real .log file; share/attach with an explicit public.plain-text UTI so iOS knows
  // the type despite the .log extension having no standard UTI of its own.
  const fileName = `nedaa-${baseName}-${ts}.log`;
  const file = new File(Paths.cache, fileName);
  try {
    file.create();
  } catch {
    // may already exist
  }
  file.write(text);
  return file.uri;
}

async function shareReportFile(text: string, baseName: string): Promise<void> {
  if (!text) return;
  const uri = writeReportFile(text, baseName);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "text/plain",
      UTI: "public.plain-text",
      dialogTitle: uri.split("/").pop(),
    });
  }
}

// One shared flush interval drives every domain (avoids leaking one timer per logger).
let flushTimer: ReturnType<typeof setInterval> | null = null;
function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => AppLogger.flushAll(), FLUSH_INTERVAL);
}

class DomainLogger {
  private domain: string;
  private buffer: string[] = [];
  // Reset per process (= per session): the first flush of a session writes a marker.
  private sessionMarked = false;
  private flushing = false;

  constructor(domain: string) {
    this.domain = domain;
  }

  d(tag: string, msg: string) {
    this.append("DEBUG", tag, msg);
  }

  i(tag: string, msg: string) {
    this.append("INFO", tag, msg);
  }

  w(tag: string, msg: string) {
    this.append("WARN", tag, msg);
  }

  e(tag: string, msg: string, error?: Error) {
    const fullMsg = error ? `${msg}: ${error.message}\n${error.stack}` : msg;
    this.append("ERROR", tag, fullMsg);
  }

  private append(level: LogLevel, tag: string, msg: string) {
    // DEBUG is verbose per-tick detail: dev builds always have it; production
    // keeps shareable logs lean unless the hidden debug mode is on — the support
    // flow is "enable debug mode, reproduce, share logs" for a full trace.
    if (level === "DEBUG" && !__DEV__ && !useDebugModeStore.getState().isEnabled) return;

    const time = formatTime(new Date());
    const line = `${time} [${level}] ${tag}: ${msg}`;
    this.buffer.push(line);

    // Console output is dev-only. In production we still persist INFO/WARN/
    // ERROR to file (for the in-app "share log" diagnostic) but emit nothing
    // to the native console.
    if (__DEV__) {
      const prefix = `[${tag}]`;
      switch (level) {
        case "DEBUG":
          console.debug(prefix, msg);
          break;
        case "INFO":
          console.info(prefix, msg);
          break;
        case "WARN":
          console.warn(prefix, msg);
          break;
        case "ERROR":
          console.error(prefix, msg);
          break;
      }
    }

    if (this.buffer.length >= FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  // Synchronous: appends a session marker (first flush of a session) + buffered
  // entries to logs/<domain>.log. No per-file header, no size rotation — retention is
  // handled globally by prune().
  flush(): void {
    if (this.buffer.length === 0 || this.flushing) return;
    this.flushing = true;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      ensureLogDir();
      const logFile = new File(logDir, `${this.domain}.log`);
      const marker = this.sessionMarked ? "" : sessionMarkerNow() + "\n";
      this.sessionMarked = true;
      const existing = logFile.exists ? logFile.textSync() : "";
      if (!logFile.exists) {
        try {
          logFile.create();
        } catch {
          // may already exist
        }
      }
      logFile.write(existing + marker + entries.join("\n") + "\n");
    } catch (error) {
      this.buffer.unshift(...entries);
      console.error(`[AppLogger] Flush failed for ${this.domain}:`, error);
    } finally {
      this.flushing = false;
    }
  }

  async getLogText(): Promise<string> {
    this.flush();
    try {
      const logFile = new File(logDir, `${this.domain}.log`);
      return logFile.exists ? logFile.textSync() : "";
    } catch {
      return "";
    }
  }

  clear(): void {
    this.buffer = [];
    this.sessionMarked = false;
    try {
      const logFile = new File(logDir, `${this.domain}.log`);
      if (logFile.exists) logFile.delete();
    } catch {
      // ignore
    }
  }

  async shareLog(): Promise<void> {
    try {
      const report = await AppLogger.buildReport({ domains: [this.domain] });
      await shareReportFile(report, `${this.domain}-log`);
    } catch (error) {
      console.error(`[AppLogger] Share failed for ${this.domain}:`, error);
    }
  }

  async copyLog(): Promise<void> {
    try {
      const report = await AppLogger.buildReport({ domains: [this.domain] });
      await Clipboard.setStringAsync(report);
    } catch (error) {
      console.error(`[AppLogger] Copy failed for ${this.domain}:`, error);
    }
  }
}

AppState.addEventListener("change", (state) => {
  if (state === "background") {
    AppLogger.flushAll();
    AppLogger.prune();
  }
});

export interface BuildReportOptions {
  domains?: string[];
  category?: string;
  description?: string;
}

export const AppLogger = {
  create(domain: string): DomainLogger {
    ensureFlushTimer();
    const existing = registry.get(domain);
    if (existing) return existing;

    const logger = new DomainLogger(domain);
    registry.set(domain, logger);
    return logger;
  },

  flushAll(): void {
    for (const logger of registry.values()) {
      logger.flush();
    }
  },

  // flush() is already synchronous; this is the explicit name the crash handler uses
  // to force everything to disk before the app dies.
  flushAllSync(): void {
    AppLogger.flushAll();
  },

  // Bound logs by age (30 days) then by a single global size cap (5 MB), trimming the
  // oldest session segments across all domains first. Run on startup and on background.
  prune(): void {
    AppLogger.flushAll();
    try {
      ensureLogDir();
    } catch {
      return;
    }
    const domains = listDomains();
    const files = domains.map((domain) => {
      const f = new File(logDir, `${domain}.log`);
      return { domain, text: f.exists ? f.textSync() : "" };
    });
    const now = new Date();
    let pruned = files.map((f) => ({
      domain: f.domain,
      text: pruneByAge(f.text, now, MAX_AGE_DAYS),
    }));
    pruned = pruneGlobalBySize(pruned, MAX_TOTAL_BYTES);
    for (const { domain, text } of pruned) {
      try {
        const f = new File(logDir, `${domain}.log`);
        if (!text) {
          if (f.exists) f.delete();
          continue;
        }
        if (!f.exists) f.create();
        f.write(text);
      } catch (e) {
        console.error(`[AppLogger] prune write failed for ${domain}:`, e);
      }
    }
  },

  // Register an extra bundle section sourced outside the file logger (e.g. the
  // background-task SQLite history). Included in full reports; a failing provider
  // renders as an error line rather than dropping the section silently.
  registerReportSection(name: string, provider: () => Promise<string>): void {
    sectionProviders.set(name, provider);
  },

  // Build the shareable diagnostic bundle: one authoritative header (current version,
  // device, OS, locale, source) + optional category/description + selected domains.
  // Domain discovery is disk-based so pre-restart logs are never omitted.
  async buildReport(opts: BuildReportOptions = {}): Promise<string> {
    AppLogger.flushAll();
    const domains = opts.domains ?? listDomains();
    const sections = domains.map((domain) => {
      const f = new File(logDir, `${domain}.log`);
      return { domain, text: f.exists ? f.textSync() : "" };
    });
    // Full (unscoped) reports also carry the registered external sections.
    if (!opts.domains) {
      for (const [name, provider] of sectionProviders) {
        const text = await provider().catch((e) => `(section failed: ${e?.message ?? e})`);
        sections.push({ domain: name, text });
      }
    }
    return buildBundle({
      header: [
        [
          "App",
          `${Application.nativeApplicationVersion ?? "unknown"} (${Application.nativeBuildVersion ?? "?"})`,
        ],
        ["Device", `${Device.brand ? `${Device.brand} ` : ""}${Device.modelName ?? "unknown"}`],
        ["OS", `${Platform.OS} ${Device.osVersion ?? "unknown"}`],
        ["Locale", Localization.getLocales?.()[0]?.languageCode ?? "unknown"],
        ["Source", getInstallSource()],
        ["Created", formatDateTime(new Date())],
      ],
      category: opts.category,
      description: opts.description,
      sections,
    });
  },

  // Build a (optionally scoped) report bundle and open the OS share sheet with the
  // .log file attached. Default = all domains.
  async shareReport(opts: BuildReportOptions = {}): Promise<void> {
    try {
      const report = await AppLogger.buildReport(opts);
      const base = opts.category ? opts.category.toLowerCase().replace(/\s+/g, "-") : "logs";
      await shareReportFile(report, base);
    } catch (error) {
      console.error("[AppLogger] Share report failed:", error);
    }
  },

  async shareAllLogs(): Promise<void> {
    return AppLogger.shareReport();
  },

  // Write arbitrary report text to a cache .log file and return its uri (for an email
  // attachment, etc.). Used by the report sheet with caller-built content.
  writeReport(text: string, baseName = "report"): string {
    return writeReportFile(text, baseName);
  },

  // Share arbitrary report text as a .log file via the OS share sheet.
  async shareText(text: string, baseName = "report"): Promise<void> {
    return shareReportFile(text, baseName);
  },

  // A short text summary for channels that can't take the file (WhatsApp/Telegram):
  // the user's note + app/device line + the most recent WARN/ERROR lines.
  async buildSummary(opts: BuildReportOptions = {}): Promise<string> {
    AppLogger.flushAll();
    const domains = opts.domains ?? listDomains();
    const issues: string[] = [];
    for (const domain of domains) {
      const f = new File(logDir, `${domain}.log`);
      if (!f.exists) continue;
      for (const line of f.textSync().split("\n")) {
        if (line.includes("[ERROR]") || line.includes("[WARN]"))
          issues.push(`${domain}: ${line.trim()}`);
      }
    }
    const recent = issues.slice(-10);
    const head = `Nedaa ${Application.nativeApplicationVersion ?? "?"} (${Application.nativeBuildVersion ?? "?"}) · ${Device.modelName ?? "?"} · ${Platform.OS} ${Device.osVersion ?? "?"}`;
    return [opts.description?.trim(), head, recent.length ? "Recent issues:" : "", ...recent]
      .filter(Boolean)
      .join("\n");
  },
};
