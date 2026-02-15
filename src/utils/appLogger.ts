import { File, Directory, Paths } from "expo-file-system";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Clipboard from "expo-clipboard";
import * as Localization from "expo-localization";
import { AppState, Platform, Share } from "react-native";

const logDir = new Directory(Paths.document, "logs");
const MAX_FILE_SIZE = 200 * 1024; // 200KB
const FLUSH_INTERVAL = 5000; // 5 seconds
const FLUSH_THRESHOLD = 20; // entries

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const registry: Map<string, DomainLogger> = new Map();

let dirReady = false;

function ensureLogDir(): void {
  if (dirReady) return;
  if (!logDir.exists) {
    logDir.create({ intermediates: true });
  }
  dirReady = true;
}

function getInstallSource(): string {
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

function buildDeviceHeader(domain: string): string {
  const appVersion = Application.nativeApplicationVersion ?? "unknown";
  const buildNumber = Application.nativeBuildVersion ?? "unknown";
  const deviceName = Device.modelName ?? "unknown";
  const deviceBrand = Device.brand ?? "";
  const osVersion = Device.osVersion ?? "unknown";
  const locale = Localization.getLocales?.()[0]?.languageCode ?? "unknown";

  return [
    "====== NEDAA DEBUG LOG ======",
    `Domain:   ${domain}`,
    `App:      ${appVersion} (${buildNumber})`,
    `Device:   ${deviceBrand ? `${deviceBrand} ` : ""}${deviceName}`,
    `OS:       ${Platform.OS} ${osVersion}`,
    `Source:   ${getInstallSource()}`,
    `Locale:   ${locale}`,
    `Started:  ${formatDateTime(new Date())}`,
    "=============================",
    "",
    "",
  ].join("\n");
}

class DomainLogger {
  private domain: string;
  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private headerWritten = false;
  private flushing = false;

  constructor(domain: string) {
    this.domain = domain;

    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, FLUSH_INTERVAL);
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
    const time = formatTime(new Date());
    const line = `${time} [${level}] ${tag}: ${msg}`;
    this.buffer.push(line);

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

    if (this.buffer.length >= FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0 || this.flushing) return;
    this.flushing = true;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      ensureLogDir();

      const logFile = new File(logDir, `${this.domain}.log`);
      const entriesText = entries.join("\n") + "\n";
      const fileExists = logFile.exists;

      if (fileExists && logFile.size + entriesText.length > MAX_FILE_SIZE) {
        const prevFile = new File(logDir, `${this.domain}.prev.log`);
        if (prevFile.exists) prevFile.delete();
        logFile.move(prevFile);
        // logFile.uri now points to prev — create fresh reference
        const freshLog = new File(logDir, `${this.domain}.log`);
        try {
          freshLog.create();
        } catch {
          // may already exist
        }
        freshLog.write(buildDeviceHeader(this.domain) + entriesText);
        this.headerWritten = true;
      } else if (fileExists) {
        const existing = logFile.textSync();
        logFile.write(existing + entriesText);
        this.headerWritten = true;
      } else {
        try {
          logFile.create();
        } catch {
          // may already exist
        }
        logFile.write(buildDeviceHeader(this.domain) + entriesText);
        this.headerWritten = true;
      }
    } catch (error) {
      this.buffer.unshift(...entries);
      console.error(`[AppLogger] Flush failed for ${this.domain}:`, error);
    } finally {
      this.flushing = false;
    }
  }

  async getLogText(): Promise<string> {
    this.flush();
    const parts: string[] = [];

    try {
      const prevFile = new File(logDir, `${this.domain}.prev.log`);
      if (prevFile.exists) {
        parts.push(prevFile.textSync());
      }
    } catch {
      // ignore
    }

    try {
      const logFile = new File(logDir, `${this.domain}.log`);
      if (logFile.exists) {
        parts.push(logFile.textSync());
      }
    } catch {
      // ignore
    }

    return parts.join("\n");
  }

  clear(): void {
    this.buffer = [];
    this.headerWritten = false;

    try {
      const logFile = new File(logDir, `${this.domain}.log`);
      if (logFile.exists) logFile.delete();
    } catch {
      // ignore
    }
    try {
      const prevFile = new File(logDir, `${this.domain}.prev.log`);
      if (prevFile.exists) prevFile.delete();
    } catch {
      // ignore
    }
  }

  async shareLog(): Promise<void> {
    this.flush();

    try {
      const logFile = new File(logDir, `${this.domain}.log`);
      if (!logFile.exists) return;

      if (Platform.OS === "ios") {
        await Share.share({ url: logFile.uri });
      } else {
        const text = logFile.textSync();
        await Share.share({ message: text, title: `${this.domain}.log` });
      }
    } catch (error) {
      console.error(`[AppLogger] Share failed for ${this.domain}:`, error);
    }
  }

  async copyLog(): Promise<void> {
    try {
      const text = await this.getLogText();
      await Clipboard.setStringAsync(text);
    } catch (error) {
      console.error(`[AppLogger] Copy failed for ${this.domain}:`, error);
    }
  }
}

AppState.addEventListener("change", (state) => {
  if (state === "background") {
    AppLogger.flushAll();
  }
});

export const AppLogger = {
  create(domain: string): DomainLogger {
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
};
