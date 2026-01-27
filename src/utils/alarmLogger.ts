import { File, Paths } from "expo-file-system/next";
import { Platform, Share, AppState, AppStateStatus } from "react-native";
import { getNativeLogs, NativeLogEntry } from "../../modules/expo-alarm/src";

type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  timestamp: Date;
  level: LogLevel;
  message: string;
};

class AlarmLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: Set<() => void> = new Set();
  private persistFile: File;
  private isInitialized = false;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 2000;

  constructor() {
    this.persistFile = new File(Paths.document, "alarm-logs.json");
    this.initialize();
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    AppState.addEventListener("change", this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === "background" || nextAppState === "inactive") {
      console.log("[AlarmLogger] App going to background, forcing save...");
      this.forceSave();
    }
  };

  private async initialize() {
    try {
      console.log("[AlarmLogger] Initializing logger...");
      await this.loadFromPersistence();
      this.isInitialized = true;

      this.info(
        `App started, platform=${Platform.OS} ${Platform.Version}, loaded ${this.logs.length} previous entries`
      );
    } catch (error) {
      console.error("[AlarmLogger] Failed to initialize:", error);
      this.isInitialized = true;
    }
  }

  private async loadFromPersistence() {
    try {
      const content = await this.persistFile.text();
      const parsed = JSON.parse(content);

      this.logs = (parsed.logs || []).map((log: any) => ({
        timestamp: new Date(log.timestamp),
        level: log.level,
        message: log.message,
      }));

      console.log(`[AlarmLogger] Loaded ${this.logs.length} logs from persistence`);
    } catch (error: any) {
      if (error?.message?.includes("ENOENT") || error?.message?.includes("No such file")) {
        console.log("[AlarmLogger] No persisted logs found (first run)");
      } else {
        console.error("[AlarmLogger] Failed to load persisted logs:", error);
      }
      this.logs = [];
    }
  }

  private async saveToPersistence() {
    try {
      const data = {
        savedAt: new Date().toISOString(),
        logCount: this.logs.length,
        logs: this.logs.map((log) => ({
          timestamp: log.timestamp.toISOString(),
          level: log.level,
          message: log.message,
        })),
      };

      await this.persistFile.write(JSON.stringify(data));
      console.log(`[AlarmLogger] Persisted ${this.logs.length} logs`);
    } catch (error) {
      console.error("[AlarmLogger] Failed to persist logs:", error);
    }
  }

  private debouncedSave() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      this.saveToPersistence();
    }, this.SAVE_DEBOUNCE_MS);
  }

  log(level: LogLevel, message: string) {
    const entry: LogEntry = { timestamp: new Date(), level, message };
    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    if (__DEV__) {
      const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : "log";
      console[consoleMethod](`[Alarm] ${message}`);
    }

    this.listeners.forEach((cb) => cb());
    this.debouncedSave();
  }

  info(msg: string) {
    this.log("info", msg);
  }

  warn(msg: string) {
    this.log("warn", msg);
  }

  error(msg: string) {
    this.log("error", msg);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsAsText(): string {
    const header = [
      "=== Nedaa Alarm Debug Log ===",
      `Generated: ${new Date().toISOString()}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `Log entries: ${this.logs.length}`,
      "=============================",
    ].join("\n");

    const lines: string[] = [];
    let currentDate = "";

    for (const entry of this.logs) {
      const entryDate = entry.timestamp.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      if (entryDate !== currentDate) {
        if (currentDate !== "") {
          lines.push("");
        }
        lines.push("");
        lines.push(`========== ${entryDate} ==========`);
        lines.push("");
        currentDate = entryDate;
      }

      const time = entry.timestamp.toLocaleTimeString("en-US", { hour12: false });
      lines.push(`[${time}] ${entry.level.toUpperCase()}: ${entry.message}`);
    }

    return header + lines.join("\n");
  }

  getLogsAsJSON(): string {
    const logsByDate: Record<string, { time: string; level: string; message: string }[]> = {};

    for (const entry of this.logs) {
      const date = entry.timestamp.toISOString().split("T")[0];
      if (!logsByDate[date]) {
        logsByDate[date] = [];
      }
      logsByDate[date].push({
        time: entry.timestamp.toLocaleTimeString("en-US", { hour12: false }),
        level: entry.level,
        message: entry.message,
      });
    }

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        platform: Platform.OS,
        platformVersion: Platform.Version,
        logCount: this.logs.length,
        days: Object.keys(logsByDate).length,
        logsByDate,
      },
      null,
      2
    );
  }

  async clear() {
    this.logs = [];
    this.listeners.forEach((cb) => cb());

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    try {
      await this.persistFile.delete();
      console.log("[AlarmLogger] Cleared persisted logs");
    } catch (error: any) {
      if (!error?.message?.includes("ENOENT") && !error?.message?.includes("No such file")) {
        console.error("[AlarmLogger] Failed to clear persisted logs:", error);
      }
    }
  }

  getPersistPath(): string {
    return this.persistFile.uri;
  }

  async forceSave() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    await this.saveToPersistence();
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async exportToFile(format: "txt" | "json" = "txt"): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `alarm-log-${timestamp}.${format}`;
      const file = new File(Paths.cache, filename);

      const content = format === "json" ? this.getLogsAsJSON() : this.getLogsAsText();

      await file.write(content);

      this.info(`Log exported to: ${filename}`);
      return file.uri;
    } catch (error) {
      this.error(`Failed to export log: ${error}`);
      return null;
    }
  }

  async shareLogFile(format: "txt" | "json" = "txt"): Promise<boolean> {
    try {
      const filePath = await this.exportToFile(format);
      if (!filePath) return false;

      if (Platform.OS === "ios") {
        await Share.share({
          url: filePath,
          title: `Nedaa Alarm Log (${format.toUpperCase()})`,
        });
      } else {
        const content = format === "json" ? this.getLogsAsJSON() : this.getLogsAsText();
        await Share.share({
          message: content,
          title: `Nedaa Alarm Log (${format.toUpperCase()})`,
        });
      }

      return true;
    } catch (error) {
      this.error(`Failed to share log: ${error}`);
      return false;
    }
  }

  async fetchAndMergeNativeLogs(): Promise<number> {
    if (Platform.OS !== "ios") {
      this.info("[Native] Not on iOS, skipping native log fetch");
      return 0;
    }

    try {
      this.info("Fetching native logs from OSLog");

      const nativeLogs = await getNativeLogs();

      if (nativeLogs.length === 0) {
        this.info("[Native] No logs found (requires iOS 15+)");
        return 0;
      }

      if (nativeLogs.length === 1 && nativeLogs[0].error) {
        this.error(`[Native] ${nativeLogs[0].error}`);
        return 0;
      }

      this.info(`[Native] Found ${nativeLogs.length} native log entries`);

      for (const entry of nativeLogs) {
        const level = entry.level === "ERROR" || entry.level === "FAULT" ? "error" : "info";
        const message = `[${entry.category}] ${entry.message}`;

        const logEntry: LogEntry = {
          timestamp: new Date(entry.timestamp),
          level,
          message,
        };
        this.logs.push(logEntry);
      }

      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      this.logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      this.info(`[Native] Merged ${nativeLogs.length} native logs`);

      this.debouncedSave();

      return nativeLogs.length;
    } catch (error) {
      this.error(`[Native] Failed to fetch native logs: ${error}`);
      return 0;
    }
  }
}

export const alarmLogger = new AlarmLogger();

export type { LogEntry, LogLevel };
